const defaults = require('./indexers/defaults');
const inverted = require('./indexers/inverted');
const geo = require('./indexers/geo');
const link = require('./indexers/link');
const { docGt, indexGt } = require('./filters/gt');
const { docGte, indexGte } = require('./filters/gt');
const { docLt, indexLt } = require('./filters/gt');
const { docLte, indexLte } = require('./filters/gt');
const { docEq, indexEq } = require('./filters/gt');
const { docNeq, indexNeq } = require('./filters/gt');
const { docBetween, indexBetween } = require('./filters/gt');
const { docMatch, indexMatch } = require('./filters/gt');

module.exports = (driver) {
  const db = james(driver);
  db.indexer('default', default.index)
  db.indexer('inverted', inverted.index)
  db.indexer('geo', geo.index)
  db.indexer('link', geo.link);
  db.filter('gt', docGt, indexGt);
  db.filter('gte', docGte, indexGte);
  db.filter('lt', docLt, indexLt);
  db.filter('lte', docLte, indexLte);
  db.filter('eq', docEq, indexEq);
  db.filter('neq', docNeq, indexNeq);
  db.filter('between', docBetween, indexBetween);
  db.filter('match', docMatch, indexMatch);
  return db;
};

