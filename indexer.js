const keys = require('./keys');
const _ = require('lodash');

class Indexer {
  constructor(db) {
    this.db = db;
    this.indexers = {};
  }
  
  use(name, indexer) {
    this.indexers[name] = indexer;
    return this;
  }

  drop(schema, index) {
    return new Promise((resolve, reject) => {
      let ops = [];
      this.db.createKeyStream({ 
        gte: keys.indexBase(schema.name, index),
        lt: keys.indexBase(schema.name, index) + '~'
      }).on('error', reject)
        .on('end', () => resolve(ops))
        .on('data', (key) => 
          ops.push({ type: 'del', key }))
    });
  }
  
  create(schema, index) {
    return new Promise((resolve, reject) => {
      let ops = [];
      this.db.createReadStream({ 
        gte: keys.docLatestBase(schema.name),
        lt: keys.docLatestBase(schema.name) + '~',
      }).on('error', reject)
        .on('end', () => resolve(ops))
        .on('data', async (data) => {
          ops.push(...this.index(schema, JSON.parse(data.value)));
        });
    });
  }

  index(schema, doc) {
    return Promise.all(Object.keys(schema.indexes)
      .map((name) => {
        const options = schema.indexes[name];
        const indexer = this.indexers[options.type];
        return indexer(this.db, schema, name, options, doc);
      })).then(_.flattenDeep)
        .then((indices) => 
          indices.map((index) => ({ 
            type: 'put', key: index, value: doc._id 
          })));
  }
}

module.exports = Indexer;
