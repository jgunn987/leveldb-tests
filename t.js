const assert = require('assert');
const level = require('level');
const jmespath = require('jmespath');
const keys = require('./keys');
const Indexer = require('./indexer');
const db = level('/tmp/test-dbi');
const indexer = new Indexer(db);


const schema1 = {
  name: 'Post',
  extends: 'Entity',
  deleteOrphan: true,
  indexes: {
    name: { type: 'default', fields: ['name'] },
  }
};

const schema2 = {
  name: 'Post',
  extends: 'Entity',
  deleteOrphan: true,
  indexes: {
    age: { type: 'default', fields: ['age'] },
  }
};

function index(db, schema, name, options, doc) {
  return Promise.resolve([
    keys.index(schema.name, name,
      options.fields.map((field) =>
        jmespath.search(doc, field) || 'NULL').join('&'), 
      doc._id)
  ]);
}

indexer.use('default', index);
indexer.drop(schema1, 'name')
  .then(console.log);
indexer.create(schema1, 'name')
  .then(console.log);
indexer.index(schema1, { _id: 1, name: 'James' })
  .then(console.log);
indexer.index(schema2, { _id: 1, name: 'James' })
  .then(console.log);
