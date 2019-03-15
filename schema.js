const keys = require('./keys');
const _ = require('lodash');

function compareIndices(a, b, action) {
  return Object.keys(a.indexes).map((index) => {
    const ai = a.indexes[index];
    const bi = b.indexes[index];
    return !bi || !_.isEqual(ai, bi) ?
      { type: action, table: a.name, index } : undefined;
  }).filter(o => o);
}

module.exports.diff = (a, b) =>
  compareIndices(a, b, 'dropIndex')
    .concat(compareIndices(b, a, 'createIndex'));
