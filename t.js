const assert = require('assert');
const level = require('level');
const jmespath = require('jmespath');
const keys = require('./keys');
const Indexer = require('./indexer');
const Schema = require('./schema');
const db = level('/tmp/test-dbi');
const indexer = new Indexer(db);
const inverted = require('./inverted');
const defaults = require('./defaults');

const schema1 = {
  name: 'Post',
  indexes: {
    name: { type: 'default', fields: ['name'] },
    title: { type: 'default', fields: ['title'], unique: true },
  }
};

const schema2 = {
  name: 'Post',
  indexes: {
    name: { type: 'default', fields: ['name'] },
    age: { type: 'default', fields: ['age'] },
    text: { type: 'inverted', fields: ['text'] },
    compound: { type: 'default', fields: ['a.b', 'c.d'] }
  }
};

console.log(Schema.diff(schema1, schema2));

indexer.use('default', defaults.index);
indexer.use('inverted', inverted.index);
indexer.drop(schema1, 'name')
  .then(console.log);
indexer.create(schema1, 'name')
  .then(console.log);
indexer.index(schema1, { _id: 1, name: 'James', title: 'mr' })
  .then(console.log);
indexer.index(schema2, { _id: 1, name: 'James', title: 'pleb', text: 'a b c'  })
  .then(console.log);
indexer.index(schema2, { _id: 1, name: 'James', title: 'pleb', text: { a: 'do' }  })
  .then(console.log);
indexer.index(schema2, { _id: 1, name: 'James', title: 'pleb', a: { b: 1 }, c: { d: 2 } })
  .then(console.log);
