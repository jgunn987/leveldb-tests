@{%
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
%}

main -> Sentence
Sentence -> NP VP | NP VP | VP
Nominal -> %Noun Nominal | %Noun
NP -> %Pronoun | %ProperNoun | %Determiner Nominal
VP -> %Verb | %Verb NP | %Verb NP PP | %Verb PP | %Verb PP PP
PP -> %Preposition NP
