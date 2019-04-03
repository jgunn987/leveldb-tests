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
  return data => Object.assign({}, data, { type }); 
}

function Expression(type) {
  return data => Object.assign({}, data, { type }); 
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
  let subject, predicates = [], current = iter.current();
  while(current) {
    switch(current.type) {
      case 'StartToken':
        current = iter.next();
        break;
      case 'ProNoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        if(subject || predicates.length) {
          throw new ParserError(current);
        } else {
          subject = NounPhraseRule(iter);
          current = iter.current();
        }
        break;
      case 'Verb':
        predicates.push(VerbPhraseRule(iter));
        current = iter.current();
        break;
      case 'Terminator':
        return SentenceExpr({
          subject, predicates
        });
      default:
        throw new ParserError(current);
    }
  }
  throw new ParserError(current);
}

function NounPhraseRule(iter) {
  let subjects = [], current = iter.current();
  while(current) {
    switch(current.type) {
      case 'ProNoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        subjects.push(current);
        current = iter.next();
        break;
      default:
        if(!subjects.length) {
          throw new ParserError(current);
        }
        return NounPhraseExpr({ subjects });
    }
  }
  throw new ParserError(current);
}

function VerbPhraseRule(iter) {
  let predicate, objects = [], current = iter.current();
  while(current) {
    switch(current.type) {
      case 'Verb':
        if(predicate) {
          return VerbPhraseExpr({
            predicate, objects
          });
        }
        predicate = current;
        current = iter.next();
        break;
      case 'PrePosition':
        objects.push(PrePositionRule(iter));
        current = iter.current();
        break;
      case 'ProNoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        objects.push(NounPhraseRule(iter));
        current = iter.current();
        break;
      default:
        if(!objects) {
          throw new ParserError(current);
        }
        return VerbPhraseExpr({
          predicate, objects
        });
    }
  }
  throw new ParserError(current);
}

function PrePositionRule(iter) {
  let positions = [], object, current = iter.current();
  while(current) {
    switch(current.type) {
      case 'PrePosition':
        if(object) {
          return PrePositionExpr({
            positions, object
          });
        }
        positions.push(current);
        current = iter.next();
        break;
      case 'Verb':
        if(object) {
          return PrePositionExpr({
            positions, object
          });
        }
        object = VerbPhraseRule(iter);
        current = iter.current();
        break;
      case 'ProNoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        if(object) {
          throw new ParserError(current);
        }
        object = NounPhraseRule(iter);
        current = iter.current();
        break;
      default:
        if(!object) {
          throw new ParserError(current);
        }
        return PrePositionExpr({
          positions, object
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
    console.log(SentenceRule(TokenIterator(parts.map(p => dict[p]))));
  });
}
REPL();
runTests();

function runTests() {
  [
    'james .',
    'james smoke .',
    'james smoke weed .',
    'james smoke weed to death .',
    'james smoke weed to death ?',
    'james john james drink beer on thursday tuesday .',
    'james john james drink beer from thursday to tuesday drive to shop .',
    'go from drink to drive in october december .'
  ].forEach(string =>
    console.log(SentenceRule(TokenIterator(string.split(' ').map(p => dict[p])))));
}
