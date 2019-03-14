const _ = require('lodash');
const jmespath = require('jmespath');
const natural = require('natural');
const keys = require('./keys');
const tokenizer = /[\W\d]+/;

function tokenize(text) {
  return _.uniq(text.split(tokenizer)
    .map(token => token.toLowerCase())
    .map(natural.PorterStemmer.stem)
    .filter(Boolean));
}

module.exports.index = (db, schema, name, options, doc) =>
  options.fields.map((field) => {
    let text = jmespath.search(doc, field);
    if(typeof text !== 'string') {
      text = JSON.stringify(text);
    }

    return tokenize(text).map((term) =>
      keys.index(schema.name, name, term, doc._id));
  });
