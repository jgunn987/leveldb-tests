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
  Determiner: Token('Determiner'),
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
const PrePositionPhraseNode = Node('PrePositionPhrase');
const VerbPhraseNode = Node('VerbPhrase');

function parse(iter) {

  function Sentence() {
    const subject = NounPhrase();
    iter.next();
    const predicate = VerbPhrase();
    return SentenceNode({
      left: subject, right: predicate
    });
  }

  function NounPhrase() {
    const current = iter.current();
    switch(current.type) {
      case 'Determiner':
        switch(iter.peek().type) {
          case 'ProNoun':
          case 'ConcreteNoun':
          case 'AbstractNoun':
          case 'ProperNoun':
            return NounPhraseRecurse(NounPhraseNode({
              left: current, right: iter.next()
            }));
        }
      case 'ProNoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        return NounPhraseRecurse(NounPhraseNode({
          left: iter.current()
        }));
    }
  }

  function NounPhraseRecurse(node) {
    let op = '';
    switch(iter.peek().type) {
      case 'PrePosition':
        iter.next();
        return NounPhraseRecurse(NounPhraseNode({
          left: node, right: PrePositionPhrase()
        }));
      case 'Conjunction':
        const conj = iter.next();
        switch(iter.peek().type) {
          case 'Determiner':
          case 'ProNoun':
          case 'ConcreteNoun':
          case 'AbstractNoun':
          case 'ProperNoun':
            return NounPhraseRecurse(NounPhraseNode({
              left: node, op: conj
            }));
        }
        return NounPhraseNode({
          left: node
        });
      case 'Determiner':
      case 'ProNoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        iter.next();
        return NounPhraseNode({
          left: node, right: NounPhrase()
        });
    }
    return node;
  }

  function VerbPhrase() {
    const current = iter.current();
    switch(current.type) {
      case 'Verb':
        switch(iter.peek().type) {
          case 'PrePosition':
            iter.next();
            return VerbPhraseRecurse(VerbPhraseNode({
              left: current, right: PrePositionPhrase()
            }));
          case 'ProNoun':
          case 'ConcreteNoun':
          case 'AbstractNoun':
          case 'ProperNoun':
            iter.next();
            return VerbPhraseRecurse(VerbPhraseNode({
              left: current, right: NounPhrase()
            }));
        }
        return VerbPhraseRecurse(VerbPhraseNode({
          left: current 
        }));
    }
  }

  function VerbPhraseRecurse(node) {
    let op = '';
    switch(iter.peek().type) {
      case 'Conjunction':
        const conj = iter.next();
        if(iter.peek().type === 'Verb') {
          return VerbPhraseRecurse(VerbPhraseNode({
            left: node, op: conj
          }));
        }
        return VerbPhraseNode({
          left: node
        });
      case 'Verb':
        iter.next();
        return VerbPhraseNode({
          left: node, right: VerbPhrase()
        });
    }
    return node;
  }

  function PrePositionPhrase() {
    const current = iter.current();
    switch(current.type) {
      case 'PrePosition':
        switch(iter.peek().type) {
          case 'Verb':
            iter.next();
            return PrePositionPhraseRecurse(
              PrePositionPhraseNode({
                left: current, right: VerbPhrase()
              }));
          case 'ProNoun':
          case 'ConcreteNoun':
          case 'AbstractNoun':
          case 'ProperNoun':
            iter.next();
            return PrePositionPhraseRecurse(
              PrePositionPhraseNode({
                left: current, right: NounPhrase()
              }));
        }
    }
  }

  function PrePositionPhraseRecurse(node) {
    let op = '';
    switch(iter.peek().type) {
      case 'Conjunction':
        const conj = iter.next();
        if(iter.peek().type === 'PrePosition') {
          return PrePositionPhraseRecurse(
            PrePositionPhraseNode({
              left: node, op: conj
            }));
        }
        return PrePositionNode({
          left: node
        });
      case 'PrePosition':
        iter.next();
        return PrePositionPhraseNode({
          left: node, right: PrePositionPhrase()
        });
    }
    return node;
  }

  return Sentence();
}

const dict = _.fromPairs(_.toPairs(lexicon).map(pair =>
  [pair[0], types[pair[1].type]({ id: pair[0] })]));

runTests();

function runTests() {
  [
    /*
    //'james .',
    //'james smoke .',
    //'james smoke weed .',
    //'james drive to john .',
    'james smoke weed to death .',
    'james and john .',
    'james , john and sue drink beer on thursday and tuesday .',
    'i go to shop to eat and to drink beer .',
    'i go to shop and to house .',
    */
    //'the car to james .',
    //'the shop the car the house james john .',
    'a car from john go and drive .',
    'a car from john go to sue and go to james and drive to shop .',
    //'a car and john and sue peter go drive and smoke weed .',
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
    const parsed = parse(TokenIterator(string.split(' ').map(p => dict[p])));
    console.log(treeify.asTree(parsed, true));
    //console.log(JSON.stringify(parsed, null, 2));
  });
}
