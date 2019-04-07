const _ = require('lodash');
const readline = require('readline');
const assert = require('assert');
const lexicon = require('./lexicon.json');
const treeify = require('treeify');

function TokenIterator(tokens) {
  let cursor = 0;
  let length = tokens.length;
  return {
    current: () => tokens[cursor],
    peek: () => tokens[cursor+1],
    next: () => tokens[++cursor],
    prev: () => tokens[(--cursor) || 0],
    index: () => cursor,
    seek: (i) => cursor = i
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

function loadLexicon(lexicon) {
  return _.fromPairs(_.toPairs(lexicon).map(pair =>
    [pair[0], types[pair[1].type]({ id: pair[0] })]));
}


function lexer(lexicon) {
  return input => TokenIterator(
    input.split(' ').filter(p => p !== '' && p !== '\n')
      .map(p => lexicon[p]));
}

const SentenceNode = Node('Sentence');
const DeclarativeSentenceNode = Node('DeclarativeSentence');
const ImperativeSentenceNode = Node('ImperativeSentence');
const NounPhraseNode = Node('NounPhrase');
const PrePositionPhraseNode = Node('PrePositionPhrase');
const VerbPhraseNode = Node('VerbPhrase');

function parse(iter) {

  function Sentence() {
    let sentence;
    const current = iter.current();
    switch(current.type) {
      case 'PrePosition':
        return;
      case 'Determiner':
      case 'ProNoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        sentence = DeclarativeSentence();
        if(!sentence) return;
        return SentenceRecurse(SentenceNode({ left: sentence }));
      case 'Verb':
        sentence = ImperativeSentence();
        if(!sentence) return;
        return SentenceRecurse(SentenceNode({ left: sentence }));
    }
  }

  function SentenceRecurse(node) {
    let right;
    switch(iter.peek().type) {
      case 'Conjunction':
        const op = iter.next();
        iter.next();
        right = Sentence();
        if(!right) return;
        return SentenceNode({
          ...node, op, right
        });
    }
    return node;
  }

  function DeclarativeSentence() {
    const subject = NounPhrase();
    if(!subject) return;
    iter.next();
    const predicate = VerbPhrase();
    if(!predicate) return;
    return DeclarativeSentenceNode({
      left: subject, right: predicate
    });
  }

  function ImperativeSentence() {
    const predicate = VerbPhrase();
    if(!predicate) return;
    return ImperativeSentenceNode({
      left: predicate
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
    let right;
    switch(iter.peek().type) {
      case 'Conjunction':
        const start = iter.index();
        const op = iter.next();
        iter.next();
        switch(iter.current().type) {
          case 'Determiner':
          case 'ProNoun':
          case 'ConcreteNoun':
          case 'AbstractNoun':
          case 'ProperNoun':
            if(op.id === ',' && Sentence()) {
              iter.seek(start);
              return node;
            }
            right = NounPhrase();
            if(!right) return;
            return NounPhraseRecurse(NounPhraseNode({
              left: node, op, right
            }));
        }
        iter.seek(start);
        return node;
      case 'Determiner':
      case 'ProNoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        iter.next();
        right = NounPhrase();
        if(!right) return;
        return NounPhraseNode({
          left: node, right
        });
    }
    return node;
  }

  function VerbPhrase() {
    let right;
    const current = iter.current();
    switch(current.type) {
      case 'Verb':
        switch(iter.peek().type) {
          case 'PrePosition':
            iter.next();
            right = PrePositionPhrase();
            if(!right) return;
            return VerbPhraseRecurse(VerbPhraseNode({
              left: current, right
            }));
          case 'ProNoun':
          case 'ConcreteNoun':
          case 'AbstractNoun':
          case 'ProperNoun':
            iter.next();
            right = NounPhrase();
            if(!right) return;
            return VerbPhraseRecurse(VerbPhraseNode({
              left: current, right
            }));
        }
        return VerbPhraseRecurse(VerbPhraseNode({
          left: current 
        }));
    }
  }

  function VerbPhraseRecurse(node) {
    let right;
    switch(iter.peek().type) {
      case 'PrePosition':
        iter.next();
        right = PrePositionPhrase();
        if(!right) return;
        return VerbPhraseRecurse(VerbPhraseNode({
          left: node, right
        }));
      case 'Conjunction':
        const start = iter.index();
        const op = iter.next();
        iter.next();
        switch(iter.current().type) {
          case 'Verb':
            right = VerbPhrase();
            if(!right) return;
            return VerbPhraseRecurse(VerbPhraseNode({
              left: node, op, right
            }));
        }
        iter.seek(start);
        return node;
      case 'Verb':
        iter.next();
        right = VerbPhrase();
        if(!right) return;
        return VerbPhraseNode({
          left: node, right
        });
    }
    return node;
  }

  function PrePositionPhrase() {
    let right;
    const current = iter.current();
    switch(current.type) {
      case 'PrePosition':
        switch(iter.peek().type) {
          case 'Conjunction':
            const op = iter.next();
            iter.next();
            right = PrePositionPhrase();
            if(!right) return;
            return PrePositionPhraseRecurse(
              PrePositionPhraseNode({
                left: current, op, right
              }));
          case 'Verb':
            iter.next();
            right = VerbPhrase();
            if(!right) return;
            return PrePositionPhraseRecurse(
              PrePositionPhraseNode({
                left: current, right
              }));
          case 'Determiner':
          case 'ProNoun':
          case 'ConcreteNoun':
          case 'AbstractNoun':
          case 'ProperNoun':
            iter.next();
            right = NounPhrase();
            if(!right) return;
            return PrePositionPhraseRecurse(
              PrePositionPhraseNode({
                left: current, right
              }));
        }
    }
  }

  function PrePositionPhraseRecurse(node) {
    switch(iter.peek().type) {
      case 'PrePosition':
        iter.next();
        right = PrePositionPhrase();
        if(!right) return;
        return PrePositionPhraseNode({
          left: node, right
        });
    }
    return node;
  }

  return Sentence();
}


runTests();

function runTests() {
  const l = lexer(loadLexicon(lexicon));
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
    //'a car from john go and drive .',
    //'a car go to and from shop .',
    //'a car from john go to sue and go to james and drive to shop .',
    //'john and james and peter .',
    //'a car and john and sue peter drive and drink to the shop and smoke weed .',
    //'i go to and from death and die .',
    //'i go to and from the shop and drink beer .',
    `james go to the shop to drink beer and smoke weed , 
     peter go to and from the shop to drink beer , 
     john go to the shop to drink beer , 
     sue smoke weed .`,
    'james and john and sue smoke weed at shop .',
    'james go to the shop and car to smoke weed .',
    'i go james to john .',
    'i go james .',
    'i go to james to john .',
    //'the go go shop .',
    //'go to a shop .'

/*
    'james , john and peter drink beer from thursday , to tuesday .',
    'go from drink to drive in october , december .',
    'james and john drink and drive .',
    'james and john drink and drive to and from house .',
    'james and john drink and drive to shop and to house .',
    'i go from shop to smoke weed .',
    'weed to death .',
    'to drink go to james .',
*/
  ].forEach(string => {
    const parsed = parse(l(string));
    console.log(string);
    console.log(treeify.asTree(parsed, true));
    //console.log(JSON.stringify(parsed, null, 2));
  });
}
