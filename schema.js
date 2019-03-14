const keys = require('./keys');
const _ = require('lodash');

class Schema {
  static diff(a, b) {
    const ops = [];
    
    for(let key of Object.keys(a.indexes)) {
      const ai = a.indexes[key];
      const bi = b.indexes[key];
      if(!bi || !_.isEqual(ai, bi)) {
        ops.push({ type: 'drop', table: a.name, index: key });
      }
    }

    for(let key of Object.keys(b.indexes)) {
      const ai = a.indexes[key];
      const bi = b.indexes[key];
      if(!ai || !_.isEqual(ai, bi)) {
        ops.push({ type: 'create', table: a.name, index: key });
      }
    }
    return ops;
  }
}

module.exports = Schema;
