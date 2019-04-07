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
const PrePositionSentenceNode = Node('PrePositionSentence');
const NounPhraseNode = Node('NounPhrase');
const PrePositionPhraseNode = Node('PrePositionPhrase');
const VerbPhraseNode = Node('VerbPhrase');

function parse(iter) {

  function Sentence() {
    let sentence;
    const current = iter.current();
    switch(current.type) {
      // you can start a sentence with a co-ordinating conjunction
      case 'Conjunction':
        switch(current.id) {
          // co-ordinating conjunctions
          case ',':
          case 'for':
          case 'and':
          case 'nor':
          case 'but':
          case 'or':
          case 'yet':
          case 'so':
            break;
          // sub ordinating conjunctions & correlative conjunctions
          case 'if':
          case 'once':
          case 'even':
          case 'before':
          case 'because':
          case 'both':
          case 'after':
          case 'either':
          case 'niether':
          case 'now':
          case 'that':
          case 'than':
          case 'since':
          case 'unless':
          case 'until':
          case 'when':
          case 'whenever':
          case 'where':
          case 'wherever':
          case 'wether':
          case 'which':
          case 'while':
          case 'who':
          case 'whoever':
          case 'why':
            break;
        }
        break;
      case 'PrePosition':
        sentence = PrePositionSentence();
        if(!sentence) return;
        return SentenceNext(SentenceNode({ left: sentence }));
      case 'Determiner':
      case 'ProNoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        sentence = DeclarativeSentence();
        if(!sentence) return;
        return SentenceNext(SentenceNode({ left: sentence }));
      case 'Verb':
        sentence = ImperativeSentence();
        if(!sentence) return;
        return SentenceNext(SentenceNode({ left: sentence }));
    }
  }

  function SentenceNext(node) {
    let right;
    switch(iter.peek().type) {
      case 'Conjunction':
        const op = iter.next();
        iter.next();
        right = Sentence();
        if(!right) return;
        return SentenceNode({
          left: node.left, op, right
        });
    }
    return node;
  }

  function PrePositionSentence() {
    const pp = PrePositionPhrase();
    if(!pp) return;
    iter.next();
    const sentence = Sentence();
    if(!sentence) return;
    return PrePositionSentenceNode({
      left: pp, right: sentence    
    });
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
            return NounPhraseNext(NounPhraseNode({
              left: current, right: iter.next()
            }));
        }
      case 'ProNoun':
      case 'ConcreteNoun':
      case 'AbstractNoun':
      case 'ProperNoun':
        return NounPhraseNext(NounPhraseNode({
          left: iter.current()
        }));
    }
  }

  function NounPhraseNext(node) {
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
            return NounPhraseNext(NounPhraseNode({
              left: node, op, right
            }));
        }
        iter.seek(start);
        return node;
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
            return VerbPhraseNext(VerbPhraseNode({
              left: current, right
            }));
          case 'ProNoun':
          case 'ConcreteNoun':
          case 'AbstractNoun':
          case 'ProperNoun':
            iter.next();
            right = NounPhrase();
            if(!right) return;
            return VerbPhraseNext(VerbPhraseNode({
              left: current, right
            }));
        }
        return VerbPhraseNext(VerbPhraseNode({
          left: current 
        }));
    }
  }

  function VerbPhraseNext(node) {
    let right;
    switch(iter.peek().type) {
      case 'PrePosition':
        iter.next();
        right = PrePositionPhrase();
        if(!right) return;
        return VerbPhraseNext(VerbPhraseNode({
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
            return VerbPhraseNext(VerbPhraseNode({
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
            return PrePositionPhraseNext(
              PrePositionPhraseNode({
                left: current, op, right
              }));
          case 'Verb':
            iter.next();
            right = VerbPhrase();
            if(!right) return;
            return PrePositionPhraseNext(
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
            return PrePositionPhraseNext(
              PrePositionPhraseNode({
                left: current, right
              }));
        }
    }
  }

  function PrePositionPhraseNext(node) {
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
    'i go to james to john and go to shop .',
    'to the shop i go .',
    'peter and james and sue go to the shop .',
    'go to a shop .'

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
    console.log(string);
    const parsed = parse(l(string));
    assert.ok(parsed);
    console.log(treeify.asTree(parsed, true));
    //console.log(JSON.stringify(parsed, null, 2));
  });
}
