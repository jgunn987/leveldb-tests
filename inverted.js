const _ = require('lodash');
const tokenizer = /[\W\d]+/;

function tokenize(text) {
  return _.uniq(text.split(tokenizer)
    .map((token) => token.toLowerCase())
    .filter(Boolean));
}

module.exports = (db) => {
  db.invertedIndex = (key, channel, text) =>
    db.batch(tokenize(text).map((token) =>
      ({ type: 'put', key: '%' + channel + ':' + token + ':' + key, value: key })));
  db.search = (term, channel) => {
    term = term.toLowerCase();
    return db.createReadStream({ 
      gte: '%' + channel + ':' + term, 
      lt: '%' + channel + ':' + term + '~' 
    });
  };

  return db;
};
