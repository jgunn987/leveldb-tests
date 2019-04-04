const _ = require('lodash');
const readline = require('readline');
const assert = require('assert');
const lexicon = require('./lexicon.json');
const treeify = require('treeify');

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
  return (data = {}) => ({ type, ...data }); 
}

function Node(type) {
  return (data = {}) => ({ type, ...data });
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

const SentenceNode = Node('Sentence');
const NounPhraseNode = Node('NounPhrase');
const NounPhraseConjNode = Node('NounPhraseConj');
const PrePositionNode = Node('PrePosition');
const PrePositionConjNode = Node('PrePositionConj');
const VerbPhraseNode = Node('VerbPhrase');
const VerbPhraseConjNode = Node('VerbPhraseConj');

function SentenceRule(iter) {
  const node = SentenceNode();
  while(iter.current()) {
    switch(iter.current().type) {
      case 'PrePosition':
        if(!node.left) {
          // special case of sentence starting with PP
          // e.g. to a park i will go
          node.left = PrePositionRule(iter);
        } else {
          return node;
        }
        break;
      case 'ProNoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        if(!node.left) {
          node.left = NounPhraseRule(iter);
        } else {
          return node;
        }
        break;
      case 'Verb':
        if(!node.left) {
          // should we make an imperative node rule here?
          node.left = VerbPhraseRule(iter);
          return node;
        } else {
          node.right = VerbPhraseRule(iter);
          return node;
        }
        break;
      default:
        return node;
    }
  }
}

function NounPhraseRule(iter) {
  const left = iter.current();
  switch(iter.next().type) {
    case 'PrePosition':
      return NounPhraseNode({
        left, right: PrePositionRule(iter)
      });
    case 'ProNoun':
    case 'ConcreteNoun':
    case 'AbstractNoun':
    case 'ProperNoun':
      return NounPhraseNode({
        left, right: NounPhraseRule(iter)
      });
    case 'Conjunction':
      return NounPhraseNode({
        left, right: NounPhraseConjRule(iter)
      });
  }
  return NounPhraseNode({ left });
}

function NounPhraseConjRule(iter) {
  const left = iter.current();
  iter.next();
  return NounPhraseConjNode({
    left, right: NounPhraseRule(iter)
  });
}

function PrePositionRule(iter) {
  const left = iter.current();
  switch(iter.next().type) {
    case 'PrePosition':
      return PrePositionNode({
        left, right: PrePositionRule(iter)
      });
    case 'ProNoun':
    case 'ConcreteNoun':
    case 'AbstractNoun':
    case 'ProperNoun':
      return PrePositionNode({
        left, right: NounPhraseRule(iter)
      });
    case 'Verb':
      return PrePositionNode({
        left, right: VerbPhraseRule(iter)
      });
    case 'Conjunction':
      return PrePositionNode({
        left, right: PrePositionConjRule(iter)
      });
  }
  return PrePositionNode({ left });
}

function PrePositionConjRule(iter) {
  const left = iter.current();
  iter.next();
  return PrePositionConjNode({
    left, right: PrePositionRule(iter)
  });
}

function VerbPhraseRule(iter) {
  const left = iter.current();
  switch(iter.next().type) {
    case 'PrePosition':
      return VerbPhraseNode({ 
        left, right: PrePositionRule(iter)
      });
    case 'ProNoun':
    case 'ConcreteNoun':
    case 'AbstractNoun':
    case 'ProperNoun':
      return VerbPhraseNode({ 
        left, right: NounPhraseRule(iter)
      });
    case 'Verb':
      return VerbPhraseNode({ 
        left, right: VerbPhraseRule(iter)
      });
    case 'Conjunction':
      return VerbPhraseNode({
        left, right: VerbPhraseConjRule(iter)
      });
  }
  return VerbPhraseNode({ left });
}

function VerbPhraseConjRule(iter) {
  const left = iter.current();
  iter.next();
  return VerbPhraseConjNode({
    left, right: VerbPhraseRule(iter)
  });
}

const dict = _.fromPairs(_.toPairs(lexicon).map(pair =>
  [pair[0], types[pair[1].type]({ id: pair[0] })]));

runTests();

function runTests() {
  [
    /*
    'james .',
    'james smoke .',
    'james smoke weed .',
    'james smoke weed to death .',
    'james and john .',
    'james , john and sue drink beer on thursday and tuesday .',
    'i go to shop to eat and to drink beer .',
    'i go to shop and to house .',
    */
    'i go to and from .',
/*
    'james , john and peter drink beer from thursday , to tuesday .',
    'go from drink to drive in october , december .',
    'james and john drink and drive .',
    'james and john drink and drive to and from house .',
    'james and john drink and drive to shop and to house .',
    'i go from shop to smoke weed .',
    'weed to death .',
    'to drink go to james .',
    'i go to death and die .',
*/
  ].forEach(string => {
    const parsed = SentenceRule(TokenIterator(string.split(' ').map(p => dict[p])));
    console.log(treeify.asTree(parsed, true));
    //console.log(JSON.stringify(parsed, null, 2));
  });
}
