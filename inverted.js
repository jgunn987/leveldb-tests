const _ = require('lodash');
const natural = require('natural');
const tokenizer = /[\W\d]+/;

function tokenize(text) {
  return _.uniq(text.split(tokenizer)
    .map(token => token.toLowerCase())
    .map(natural.PorterStemmer.stem)
    .filter(Boolean));
}

function searchTerm(db, term, channel) {
  return new Promise((resolve, reject) => {
    const results = [];
    db.createReadStream({ 
      gte: '%' + channel + ':' + term, 
      lt: '%' + channel + ':' + term + '~' 
    }).on('error', reject)
      .on('end', () => resolve(results))
      .on('close', () => resolve(results))
      .on('data', data => results.push(data.value));
  });
}

function intersection(sets) {
  return sets.map(set => _.uniq(set)).
    reduce((p, c) => c.filter(entry => p.indexOf(entry) !== -1));
}

module.exports = db => {
  db.invertedIndex = (key, channel, text) =>
    db.batch(tokenize(text).map(token =>
      ({ type: 'put', key: '%' + channel + ':' + token + ':' + key, value: key })));

  db.search = (terms, channel) => 
    Promise.all(tokenize(terms).map(term => searchTerm(db, term, channel)))
      .then(results => Promise.all(intersection(results).map((key) => db.get(key))));

  return db;
};
