const _ = require('lodash');
const nearley = require("nearley");
const grammar = require("./grammar.js");
const parser = new nearley.Parser(
  nearley.Grammar.fromCompiled(grammar));

// Parse something!
parser.feed(["i", 'need']);

// parser.results is an array of possible parsings.
console.log(_.flattenDeep(parser.results)); 

function ParseError(data = {}) {
  const me = type => me;
  return Object.assign(me, data, {
    type: 'ParseError'
  });
}

function Pronoun(data = {}) {
  const me = type => {
    switch(type.type) {
      case 'ParseError':
        return type;
      case 'Verb':
        return Pronoun({
          ...data,
          action: type
        });
    }
    return ParseError();
  };
  return Object.assign(me, data, {
    type: 'Pronoun'
  });
}

function ProperNoun(data = {}) {
  const me = type => {
    switch(type.type) {
      case 'ParseError':
        return type;
      case 'Verb':
        return ProperNoun({
          ...data,
          action: type
        });
    }
    return ParseError();
  };
  return Object.assign(me, data, {
    type: 'ProperNoun'
  });
}

function ConcreteNoun(data = {}) {
  const me = type => {
    switch(type.type) {
      case 'ParseError':
        return type;
      case 'Verb':
        return ConcreteNoun({
          ...data,
          action: type
        });
    }
    return ParseError();
  };
  return Object.assign(me, data, {
    type: 'ConcreteNoun'
  });
}

function AbstractNoun(data = {}) {
  const me = type => {
    switch(type.type) {
      case 'ParseError':
        return type;
      case 'Verb':
        return AbstractNoun({
          ...data,
          action: type
        });
    }
    return ParseError();
  };
  return Object.assign(me, data, {
    type: 'AbstractNoun'
  });
}

function Preposition(data = {}) {
  const me = type => {
    switch(type.type) {
      case 'ParseError':
        return type;
      case 'Pronoun':
      case 'AbstractNoun':
      case 'ProperNoun':
      case 'ConcreteNoun':
        return Preposition({
          ...data, object: type    
        });
    }
    return ParseError();
  };
  return Object.assign(me, data, {
    type: 'Preposition'
  });
}

function Verb(data = {}) {
  const me = type => {
    switch(type.type) {
      case 'ParseError':
        return type;
      case 'Preposition':
      case 'Pronoun':
      case 'AbstractNoun':
      case 'ProperNoun':
      case 'ConcreteNoun':
        return Verb({
          ...data, objects: 
            me.objects.concat([type])
        });
    }
    return ParseError();
  };
  return Object.assign(me, data, {
    type: 'Verb',
    objects: data.objects || []
  });
}

const lexicon = {
  'i': Pronoun({ id: 'i' }), 
  'this': Pronoun({ id: 'this' }), 
  'here': Pronoun({ id: 'here' }), 
  'there': Pronoun({ id: 'there' }), 
  'me': Pronoun({ id: 'me' }), 
  'you': Pronoun({ id: 'you' }), 
  'they': Pronoun({ id: 'they' }), 
  'us': Pronoun({ id: 'us' }), 
  'them': Pronoun({ id: 'them' }), 
  'it': Pronoun({ id: 'it' }), 
  'that': Pronoun({ id: 'that' }), 
  
  'james': ProperNoun({ id: 'james' }),
  'stephen': ProperNoun({ id: 'stephen' }),
  'tom': ProperNoun({ id: 'tom' }),
  'sue': ProperNoun({ id: 'sue' }),
  'harry': ProperNoun({ id: 'harry' }),
  
  'death': AbstractNoun({ id: 'death' }),
  
  'beer': ConcreteNoun({ id: 'beer' }),
  'weed': ConcreteNoun({ id: 'weed' }),
  'hell': ConcreteNoun({ id: 'hell' }),

  'at': Preposition({ id: 'at' }),
  'to': Preposition({ id: 'to' }),
  'from': Preposition({ id: 'from' }),
  'in': Preposition({ id: 'in' }),
  'with': Preposition({ id: 'with' }),
  'up': Preposition({ id: 'up' }),
  
  'go': Verb({ id: 'go' }),
  'move': Verb({ id: 'move' }),
  'walk': Verb({ id: 'walk' }),
  'talk': Verb({ id: 'talk' }),
  'drink': Verb({ id: 'drink' }),
  'smoke': Verb({ id: 'smoke' }),
  'laugh': Verb({ id: 'laugh' }),
  'have': Verb({ id: 'have' }),
};


const readline = require('readline');
const input = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

input.on('line', function(line){
  const parts = line
    .split(/[\W\d]+/)
    .map(part => lexicon[part])
    .reverse()
    .reduce((p, c) => c(p));
  console.log(parts);
});
