const assert = require('assert');
const jmespath = require('jmespath');
const uuid = require('uuid');
const _ = require('lodash');
const mergeStream = require('merge-stream');
const { Transform } = require('stream');

function docLatestBaseKey(table) {
  return `%${table}/$latest`;
}
  
function indexBaseKey(table, indexName) {
  return `%${table}/$i/${indexName}`;
}

function docLatestKey(table, uuid) {
  return `%${table}/$latest:${uuid}`;
}
  
function docKey(table, uuid, version) {
  return `%${table}/$v/${version}:${uuid}`;
}

function indexKey(table, indexName, value, uuid) {
  return `%${table}/$i/${indexName}:${value}` + (uuid ? ':' + uuid : '');
}

function scanAllDocuments(db, schema) {
  return db.createReadStream({ 
    gte: docLatestBaseKey(schema.name),
    lt: docLatestBaseKey(schema.name) + '~'
  });
}

function scanAllIndexKeys(db, schema, indexName) {
  return db.createKeyStream({ 
    gte: indexBaseKey(schema.name, indexName),
    lt: indexBaseKey(schema.name, indexName) + '~'
  });
}

function dropIndex(db, schema, indexName) {
  return scanAllIndexKeys(db, schema, indexName)
    .pipe(new Transform({
       objectMode: true,
       transform(key, encoding, done) {
         return done(null, { type: 'del', key });
       } 
     }));
}

function indexDocuments(db, schema, indexes) {
  return scanAllDocuments(db, schema)
    .pipe(new Transform({
      objectMode: true,
      transform(data, enc, done) {
        const doc = JSON.parse(data.value);
        if(!doc) return done();
        indexDocument(db, schema, doc, indexes)
          .then((ops) => ops.map((op) => this.push(op)))
          .then((ops) => done());
      }
    }));
}

async function unindexDocument(db, schema, doc, indexes) {
  return (await generateIndexKeys(db, schema, doc, indexes)).map((key) => ({
    type: 'del', key, value: doc._id 
  }));
}

async function indexDocument(db, schema, doc, indexes) {
  return (await generateIndexKeys(db, schema, doc, indexes)).map((key) => ({
    type: 'put', key, value: doc._id 
  }));
}

function generateIndexKeys(db, schema, doc, indexes) {
  return Promise.all((indexes || Object.keys(schema.indexes)).map((name) => 
    invokeIndexer(db, schema, name, doc)))
    .then(_.flattenDeep);
}

function invokeIndexer(db, schema, name, doc) {
  return db.indexers[schema.indexes[name].type]
    (db, schema, name, schema.indexes[name], doc);
}

async function defaultIndexer(db, schema, name, options, doc) {
  const key = defaultIndexerGenerateKey(schema, name, options, doc);
  /* TODO: where to put constraint validation? we can call this
   *       function when unindexing, that will trigger a violation on
   *       a unique constraint...
   * if (options.unique) {
    try { 
      await db.get(key);
    } catch(err) { 
      return [key];
    }
    throw new Error(`Duplicate key on index ${name}`);
  }*/
  return [key];
}

function defaultIndexerGenerateKey(schema, name, options, doc) {
  return indexKey(schema.name, name, 
    options.fields.map((field) => 
      jmespath.search(doc, field) || 'NULL').join('&'), 
    !options.unique && doc._id); 
}

function migrate(db, p, c) {
  return new Promise((resolve, reject) => {
    const batch = db.batch();
    createMigrationStream(db, p, c)
      .on('end', () => Promise.resolve(batch.write()))
      .on('close', () => Promise.resolve(batch.write()))
      .on('data', (data) => {
        if(data.type === 'put') {
          batch.put(data.key, data.value);
        } else if(data.type === 'del') {
          batch.del(data.key);
        }  
      });
  });
}
/* TODO: We cannot merge create and drop streams
 *       as we may delete a newly created index
 *       we must run the create indexer on specific new fields
 */
function createMigrationStream(db, p, c) {
  const streams = mergeStream();
  const diff = diffSchema(p, c);
  const create = [];

  diff.forEach((op) => {
    if(op.type === 'dropIndex') {
      streams.add(dropIndex(db, p, op.index));
    } else if(op.type === 'createIndex') {
      create.push(op.index);
    }
  });

  if(create.length) {
    streams.add(indexDocuments(db, c, create));
  }
  return streams;
}

function diffSchema(old, current) {
  return compareIndices(old, current, 'dropIndex')
    .concat(compareIndices(current, old, 'createIndex'));
}

function compareIndices(a, b, action) {
  return Object.keys(a.indexes).map((index) => {
    const ai = a.indexes[index];
    const bi = b.indexes[index];
    return !bi || !_.isEqual(ai, bi) ?
      { type: action, table: a.name, index } : undefined;
  }).filter(Boolean);
}

async function putDocument(db, table, doc) {
  const schema = db.schemas[table];
  const newDoc = createDocument(db, doc);
  const json = JSON.stringify(newDoc);
  await db.batch([
    ...await indexDocument(db, schema, newDoc), 
    { type: 'put', key: docLatestKey(table, newDoc._id), value: json },
    { type: 'put', key: docKey(table, newDoc._id, newDoc._v), value: json }
  ]);
  return newDoc._id;
}

function createDocument(db, doc) {
  return Object.assign({}, doc || {}, {
    _id: doc._id || uuid.v4(),
    _v: (+new Date()).toString()
  });
}

async function getDocument(db, table, uuid, version) {
  return JSON.parse(version ?
    await db.get(docKey(table, uuid, version)):
    await db.get(docLatestKey(table, uuid)));
}

async function delDocument(db, table, uuid) {
  const doc = await getDocument(db, table, uuid);
  return await db.batch([
    ...await unindexDocument(db, db.schemas[table], doc), 
    { type: 'put', key: docLatestKey(table, doc._id), value: 'null' }
  ]);
}

const db = require('level')('/tmp/test-db');
db.indexers = {};
db.indexers.default = defaultIndexer; 
db.schemas = {};
db.schemas.User = {
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

const diff = diffSchema(db.schemas.User, userSchema2);
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

Promise.all([
  putDocument(db, 'User', { name: 'Jameson', email: 'jgunn987@gmail.com' }),
  putDocument(db, 'User', { name: 'Jameson1', email: 'jgunn987@gmail.com1' }),
  putDocument(db, 'User', { name: 'Jameson2', email: 'jgunn987@gmail.com2' }),
  putDocument(db, 'User', { name: 'Jameson3', email: 'jgunn987@gmail.com3' }),
  putDocument(db, 'User', { name: 'Jameson4', email: 'jgunn987@gmail.com4' }),
  putDocument(db, 'User', { name: 'Jameson5', email: 'jgunn987@gmail.com5' }),
  putDocument(db, 'User', { name: 'Jameson6', email: 'jgunn987@gmail.com6' }),
]).then(async (ids) => {
  const newDoc = await getDocument(db, 'User', ids[0]);
  assert.ok(newDoc._id === ids[0]);
  assert.ok(newDoc._v);
  assert.ok(newDoc.name === 'Jameson');
  assert.ok(newDoc.email === 'jgunn987@gmail.com');
  const versionDoc = await getDocument(db, 'User', ids[0], newDoc._v);
  assert.ok(_.isEqual(newDoc, versionDoc));
  const indexes = await indexDocument(db, db.schemas['User'], versionDoc);
  assert.ok(indexes.length === 2);
  await delDocument(db, 'User', ids[0]);
  const delDoc = await getDocument(db, 'User', ids[0]);
  assert.ok(!delDoc);

  createMigrationStream(db, db.schemas['User'], userSchema2)
    .on('data', console.log);
});

indexDocument(db, db.schemas.User, { _id: '1', name: 'James', email: 'jgunn987@gmail.com' })
  .then((keys) => {
    assert.ok(keys.length === 2);
    assert.ok(keys[0].type === 'put');
    assert.ok(keys[0].key === '%User/$i/name:James:1');
    assert.ok(keys[0].value === '1');
    assert.ok(keys[1].type === 'put');
    assert.ok(keys[1].key === '%User/$i/email:jgunn987@gmail.com');
    assert.ok(keys[1].value === '1');
  });

