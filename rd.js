const assert = require('assert');

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

const StartToken = Token('StartToken');
const ProperNoun = Token('ProperNoun');
const AbstractNoun = Token('AbstractNoun');
const ConcreteNoun = Token('ConcreteNoun');
const ProNoun = Token('ProNoun');
const PrePosition = Token('PrePosition');
const Adjective = Token('Adjective');
const Determiner = Token('Determiner');
const Conjunction = Token('Conjunction');
const Adverb = Token('Adverb');
const Verb = Token('Verb');
const Terminator = Token('Terminator');

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


/*
try {
console.log(SentenceRule(TokenIterator([
  StartToken(),
  ProperNoun({ id: 'james' })
])));
} catch(err) {}

try {
console.log(SentenceRule(TokenIterator([
  StartToken(),
  ProperNoun({ id: 'james' }),
  Verb({ id: 'smoke' }),
])));
} catch(err) {}
*/

console.log(SentenceRule(TokenIterator([
  StartToken(),
  ProperNoun({ id: 'james' }),
  ProperNoun({ id: 'stephen' }),
  ProperNoun({ id: 'john' }),

  Verb({ id: 'smoke' }),
  ConcreteNoun({ id: 'weed' }),
  ConcreteNoun({ id: 'crack' }),
  PrePosition({ id: 'at' }),
  PrePosition({ id: 'from' }),
  AbstractNoun({ id: 'tuesday' }),
  PrePosition({ id: 'to' }),
  AbstractNoun({ id: 'thursday' }),

  Verb({ id: 'go' }),
  PrePosition({ id: 'to' }),
  ConcreteNoun({ id: 'shop' }),

  Terminator({ id: '.' })
])));
/*
console.log(SentenceRule(TokenIterator([
  StartToken(),
  ProperNoun({ id: 'james' }),
  Verb({ id: 'smoke' }),
  ConcreteNoun({ id: 'weed' }),
  Terminator({ id: '.' })
])));

console.log(SentenceRule(TokenIterator([
  StartToken(),
  Verb({ id: 'smoke' }),
  ConcreteNoun({ id: 'weed' }),
  PrePosition({ id: 'to' }),
  AbstractNoun({ id: 'death' }),
  Terminator({ id: '.' })
])));

console.log(SentenceRule(TokenIterator([
  StartToken(),
  Verb({ id: 'smoke' }),
  ConcreteNoun({ id: 'weed' }),
  PrePosition({ id: 'to' }),
  AbstractNoun({ id: 'death' }),
  Terminator({ id: '?' })
])));

console.log(SentenceRule(TokenIterator([
  StartToken(),
  Verb({ id: 'go' }),
  PrePosition({ id: 'from' }),
  Verb({ id: 'drink' }),
  PrePosition({ id: 'to' }),
  Verb({ id: 'drive' }),
  PrePosition({ id: 'in' }),
  AbstractNoun({ id: 'october' }),
  Terminator({ id: '.' })
])));
*/
