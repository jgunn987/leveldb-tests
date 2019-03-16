const assert = require('assert');
const jmespath = require('jmespath');
const uuid = require('uuid');
const _ = require('lodash');
const { Transform } = require('stream');
const keys = require('./keys');

function docLatestBase(table) {
  return `%${table}/$latest`;
}
  
function indexBase(table, indexName) {
  return `%${table}/$i/${indexName}`;
}

function scanAllDocuments(db, schema) {
  return db.createReadStream({ 
    gte: docLatestBase(schema.name),
    lt: docLatestBase(schema.name) + '~'
  });
}

function scanAllIndexKeys(db, schema, indexName) {
  return db.createKeyStream({ 
    gte: indexBase(schema.name, indexName),
    lt: indexBase(schema.name, indexName) + '~'
  });
}

function dropIndex(db, schema, index) {
  return scanAllIndexKeys(db, schema, index)
    .pipe(new Transform({
       transform(key, encoding, done) {
         return done(null, { type: 'del', key });
       } 
     }));
}

function indexAllDocuments(db, schema) {
  return scanAllDocuments(db, schema)
    .pipe(new Transform({
      objectMode: true,
      transform(data, enc, done) {
        indexDocument(db, schema, JSON.parse(data.value))
          then((ops) => ops.map((op) => this.push(op)));
      }
    }));
}

function indexDocument(db, schema, doc) {
  return Promise.all(Object.keys(schema.indexes).map((name) => 
    invokeIndexer(db, schema, name, doc)))
    .then(_.flattenDeep).then((indices) =>
      indices.map((key) => ({ 
        type: 'put', key, value: doc._id 
      })));
}

function invokeIndexer(db, schema, name, doc) {
  return db.indexers[schema.indexes[name].type]
    (db, schema, name, schema.indexes[name], doc);
}

function defaultIndexer(db, schema, name, options, doc) {
  return [ keys.index(schema.name, name, 
    options.fields.map((field) => 
      jmespath.search(doc, field) || 'NULL').join('&'), 
    !options.unique && doc._id) ];
}

function compareIndices(a, b, action) {
  return Object.keys(a.indexes).map((index) => {
    const ai = a.indexes[index];
    const bi = b.indexes[index];
    return !bi || !_.isEqual(ai, bi) ?
      { type: action, table: a.name, index } : undefined;
  }).filter(o => o);
}

function diffSchema(a, b) {
  return compareIndices(a, b, 'dropIndex')
    .concat(compareIndices(b, a, 'createIndex'));
}

function migrate(db, schema) {
  diffSchema(
}

function createDocument(db, source) {
  return Object.assign({}, source, {
    _id: source._id || uuid.v4(),
    _v: (+new Date()).toString()
  });
}

const db = require('level')('/tmp/dddbbb');
db.indexers = {};
db.indexers.default = defaultIndexer; 
const userSchema = {
  name: 'User',
  indexes: {
    name: { type: 'default', fields: ['name'] },
    email: { type: 'default', fields: ['email'], unique: true }
  }
};
const userSchema2 = {
  name: 'User',
  indexes: {
    name: { type: 'default', fields: ['name'] },
    email: { type: 'default', fields: ['email'] },
    tagline: { type: 'default', fields: ['tagline'] }
  }
};

const diff = diffSchema(userSchema, userSchema2);
assert.ok(diff.length === 3);
assert.ok(diff[0].type === 'dropIndex');
assert.ok(diff[0].table === 'User');
assert.ok(diff[0].index === 'email');
assert.ok(diff[1].type === 'createIndex');
assert.ok(diff[1].table === 'User');
assert.ok(diff[1].index === 'email');
assert.ok(diff[2].type === 'createIndex');
assert.ok(diff[2].table === 'User');
assert.ok(diff[2].index === 'tagline');

const doc = createDocument(db, { title: 'Create' });
assert.ok(doc._id);
assert.ok(doc._v);

indexDocument(db, userSchema, { _id: '1', name: 'James', email: 'jgunn987@gmail.com' })
  .then((keys) => {
    assert.ok(keys.length === 2);
    assert.ok(keys[0].type === 'put');
    assert.ok(keys[0].key === '%User/$i/name:James:1');
    assert.ok(keys[0].value === '1');
    assert.ok(keys[1].type === 'put');
    assert.ok(keys[1].key === '%User/$i/email:jgunn987@gmail.com');
    assert.ok(keys[1].value === '1');
  });

