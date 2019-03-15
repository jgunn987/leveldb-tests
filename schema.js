const keys = require('./keys');
const _ = require('lodash');

function compareIndices(a, b, action) {
  const ops = [];
  for(let key of Object.keys(a.indexes)) {
    const ai = a.indexes[key];
    const bi = b.indexes[key];
    if(!bi || !_.isEqual(ai, bi)) {
      ops.push({ type: action, table: a.name, index: key });
    }
  }
  return ops;
}

module.exports.diff = (a, b) =>
  compareIndices(a, b, 'drop')
    .concat(compareIndices(b, a, 'create'));
