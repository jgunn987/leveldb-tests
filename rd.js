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

function ParserError(data = {}) {
  return Object.assign({
    token: data,
    type: 'ParserError' 
  });
}

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
      case 'Pronoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        if(subject || predicates.length) {
          throw ParserError(current);
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
        throw ParserError(current);
    }
  }
  throw ParserError(current);
}

function NounPhraseRule(iter) {
  let subjects = [], current = iter.current();
  while(current) {
    switch(current.type) {
      case 'Pronoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        subjects.push(current);
        current = iter.next();
        break;
      default:
        if(!subjects.length) {
          throw ParserError(current);
        }
        return NounPhraseExpr({ subjects });
    }
  }
  throw ParserError(current);
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
      case 'Pronoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        objects.push(NounPhraseRule(iter));
        current = iter.current();
        break;
      default:
        if(!objects) {
          throw ParserError(current);
        }
        return VerbPhraseExpr({
          predicate, objects
        });
    }
  }
  throw ParserError(current);
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
      case 'Pronoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        if(object) {
          throw ParserError(current);
        }
        object = NounPhraseRule(iter);
        current = iter.current();
        break;
      default:
        if(!object) {
          throw ParserError(current);
        }
        return PrePositionExpr({
          positions, object
        });
    }
  }
  throw ParserError(current);
}

const dict = _.fromPairs(_.toPairs(lexicon).map(pair =>
  [pair[0], types[pair[1].type]({ id: pair[0] })]));

function REPL() {
  readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  }).on('line', function(line){
    const parts = line.split(' ');
    console.log(SentenceRule(TokenIterator(parts.map(p => dict[p]))));
  });
}

function runTests() {
  console.log(SentenceRule(TokenIterator(
    'james .'
    .split(' ').map(p => dict[p]))));
  console.log(SentenceRule(TokenIterator(
    'james smoke .'
    .split(' ').map(p => dict[p]))));
  console.log(SentenceRule(TokenIterator(
    'james smoke weed .'
    .split(' ').map(p => dict[p]))));
  console.log(SentenceRule(TokenIterator(
    'james smoke weed to death .'
    .split(' ').map(p => dict[p]))));
  console.log(SentenceRule(TokenIterator(
    'james smoke weed to death ?'
    .split(' ').map(p => dict[p]))));
  console.log(SentenceRule(TokenIterator(
    'james john james drink beer on thursday tuesday .'
    .split(' ').map(p => dict[p]))));
  console.log(SentenceRule(TokenIterator(
    'james john james drink beer from thursday to tuesday drive to shop .'
    .split(' ').map(p => dict[p]))));
  console.log(SentenceRule(TokenIterator(
    'go from drink to drive in october december .'
    .split(' ').map(p => dict[p]))));
}
