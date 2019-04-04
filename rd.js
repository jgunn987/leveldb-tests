const _ = require('lodash');
const readline = require('readline');
const assert = require('assert');
const lexicon = require('./lexicon.json');

function TokenIterator(tokens) {
  let cursor = 0;
  return {
    current: () => tokens[cursor],
    peek: () => tokens[cursor+1],
    next: () => tokens[++cursor],
    prev: () => tokens[(cursor - 1) || 0]
  };
}

class ParserError extends Error {}

function Token(type) {
  return data => ({ type, ...data }); 
}

function Expression(type) {
  return data => ({ type, ...data }); 
}

const types = {
  StartToken: Token('StartToken'),
  ProperNoun: Token('ProperNoun'),
  AbstractNoun: Token('AbstractNoun'),
  ConcreteNoun: Token('ConcreteNoun'),
  ProNoun: Token('ProNoun'),
  PrePosition: Token('PrePosition'),
  Adjective: Token('Adjective'),
  Determiner: Token('Determiner'),
  Conjunction: Token('Conjunction'),
  Adverb: Token('Adverb'),
  Verb: Token('Verb'),
  Terminator: Token('Terminator'),
};

const SentenceExpr = Expression('SentenceExpr');
const CompoundSentenceExpr = Expression('CompoundSentenceExpr');
const ConditionalSentenceExpr = Expression('ConditionalSentenceExpr');
const InterrogativeSentenceExpr = Expression('InterrogativeSentenceExpr');
const CompoundExpr = Expression('CompoundExpr');
const NounPhraseExpr = Expression('NounPhraseExpr');
const VerbPhraseExpr = Expression('VerbPhraseExpr');
const PrePositionExpr = Expression('PrePositionExpr');

function CompoundSentenceRule(iter) {}
function ConditionalSentenceRule(iter) {}
function InterrogativeSentenceRule(iter) {}

function SentenceRule(iter) {
  let subject, predicate, current = iter.current();
  while(current) {
    switch(current.type) {
      case 'StartToken':
        current = iter.next();
        break;
      case 'PrePosition':
        subject = PrePositionRule(iter);
        current = iter.current();
        break;
      case 'ProNoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        if(subject || predicate) {
          throw new ParserError(current);
        } else {
          subject = NounPhraseRule(iter);
          current = iter.current();
        }
        break;
      case 'Verb':
        if(predicate) {
          throw new ParserError(current);
        }
        predicate = VerbPhraseRule(iter);
        current = iter.current();
        break;
      case 'Terminator':
        return SentenceExpr({
          subject, predicate
        });
      default:
        throw new ParserError(current);
    }
  }
  throw new ParserError(current);
}

function NounPhraseRule(iter) {
  let subject = CompoundExpr({ expressions: [] }), 
      current = iter.current();
  while(current) {
    switch(current.type) {
      case 'PrePosition':
        subject.expressions.push(PrePositionRule(iter));
        current = iter.current();
        break;
      case 'ProNoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        subject.expressions.push(current);
        current = iter.next();
        break;
      case 'Conjunction':
        if(!subject.expressions.length) {
          throw new ParserError(current);
        }
        current = iter.next();
        break;
      default:
        if(!subject) {
          throw new ParserError(current);
        }
        return NounPhraseExpr({ subject });
    }
  }
  throw new ParserError(current);
}


function VerbPhraseRule(iter) {
  let predicate = CompoundExpr({ expressions: [] }), 
      object = CompoundExpr({ expressions: [] }), 
      current = iter.current();
  while(current) {
    switch(current.type) {
      case 'Verb':
        if(object.expressions.length) {
          object.expressions.push(current);
        } else {
          predicate.expressions.push(current);
        }
        current = iter.next();
        break;
      case 'PrePosition':
        object.expressions.push(PrePositionRule(iter));
        current = iter.current();
        break;
      case 'ProNoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        object.expressions.push(NounPhraseRule(iter));
        current = iter.current();
        break;
      case 'Conjunction':
        current = iter.next();
        break;
      default:
        if(!predicate) {
          throw new ParserError(current);
        }
        return VerbPhraseExpr({
          predicate, object
        });
    }
  }
  throw new ParserError(current);
}

function PrePositionRule(iter) {
  let position = CompoundExpr({ expressions: [] }), 
      object = CompoundExpr({ expressions: [] }), 
      current = iter.current();
  while(current) {
    switch(current.type) {
      case 'PrePosition':
        if(object.expressions.length) {
          return PrePositionExpr({
            position, object
          });
        }
        position.expressions.push(current);
        current = iter.next();
        break;
      case 'Verb':
        if(object.expressions.length) {
          return PrePositionExpr({
            position, object
          });
        }
        object.expressions.push(VerbPhraseRule(iter));
        current = iter.current();
        break;
      case 'ProNoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        if(object.expressions.length) {
          throw new ParserError(current);
        }
        object.expressions.push(NounPhraseRule(iter));
        current = iter.current();
        break;
      case 'Conjunction':
        current = iter.next();
        break;
      default:
        if(!object.expressions.length) {
          throw new ParserError(current);
        }
        return PrePositionExpr({
          position, object
        });
    }
  }
  throw new ParserError(current);
}

const dict = _.fromPairs(_.toPairs(lexicon).map(pair =>
  [pair[0], types[pair[1].type]({ id: pair[0] })]));

function REPL() {
  console.log(dict);
  readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  }).on('line', function(line){
    const parts = line.split(' ');
    parts.push('.');
    const parsed = SentenceRule(TokenIterator(parts.map(p => dict[p])));
    console.log(JSON.stringify(parsed, null, 2));
  });
}
//REPL();
runTests();

function runTests() {
  [
/*
    'james .',
    'james smoke .',
    'james smoke weed .',
    'james smoke weed to death .',
    'james smoke weed to death ?',
    'james , john and sue drink beer on thursday and tuesday .',
    'james , john and peter drink beer from thursday , to tuesday .',
    'go from drink to drive in october , december .',
    'james and john drink and drive .',
    'james and john drink and drive to and from house .',
    'james and john drink and drive to shop and to house .',
    'i go from shop to smoke weed .',
    'i go to shop to eat and to drink beer .',
    'weed to death .',
    'to drink go to james .',
*/
    'i go to death and die .',
  ].forEach(string => {
    const parsed = SentenceRule(TokenIterator(string.split(' ').map(p => dict[p])));
    console.log(JSON.stringify(parsed, null, 2));
  });
}
