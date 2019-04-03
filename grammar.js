// Generated automatically by nearley, version 2.16.0
// http://github.com/Hardmath123/nearley
(function () {
function id(x) { return x[0]; }

const lexicon = require('./lexicon.json');
const test = l => x => l.indexOf(x) !== -1;
const Noun = { test: test(lexicon.Noun) };
const Pronoun = { test: test(lexicon.Pronoun) };
const ProperNoun = { test: test(lexicon.ProperNoun) };
const Verb = { test: test(lexicon.Verb) };
const Adjective = { test: test(lexicon.Adjective) };
const Determiner = { test: test(lexicon.Determiner) };
const Preposition = { test: test(lexicon.Preposition) };
const Conjunction = { test: test(lexicon.Conjunction) };
const AuxVerb = { test: test(lexicon.AuxVerb) };
var grammar = {
    Lexer: undefined,
    ParserRules: [
    {"name": "main", "symbols": ["Sentence"]},
    {"name": "Sentence", "symbols": ["NP", "VP"]},
    {"name": "Sentence", "symbols": [AuxVerb, "NP", "VP"]},
    {"name": "Sentence", "symbols": ["VP"]},
    {"name": "NP", "symbols": [Pronoun]},
    {"name": "NP", "symbols": [ProperNoun]},
    {"name": "NP", "symbols": [Determiner, "Nominal"]},
    {"name": "Nominal", "symbols": [Noun, "Nominal"]},
    {"name": "Nominal", "symbols": [Noun]},
    {"name": "VP", "symbols": [Verb]},
    {"name": "VP", "symbols": [Verb, "NP"]},
    {"name": "VP", "symbols": [Verb, "NP", "PP"]},
    {"name": "VP", "symbols": [Verb, "PP"]},
    {"name": "PP", "symbols": [Preposition, "NP"]}
]
  , ParserStart: "main"
}
if (typeof module !== 'undefined'&& typeof module.exports !== 'undefined') {
   module.exports = grammar;
} else {
   window.grammar = grammar;
}
})();
