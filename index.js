const assert = require('assert');
const jmespath = require('jmespath');
const uuid = require('uuid');
const _ = require('lodash');
const mergeStream = require('merge-stream');
const { Transform } = require('stream');
const natural = require('natural');
const tokenizer = /[\W\d]+/;
const vm = require('vm');
const esprima = require('esprima');

// for storing views
function compareFunctions(a, b) {
  const ap = esprima.parse(a);
  const bp = esprima.parse(b);
  return _.isEqual(ap, bp);
}

function compileFn(db, fn) {
  return new vm.Script(fn)
    .runInContext(db.viewContext);
}

function tid(n) {
  return +new Date() + ("0000000000000000")
    .substr((16 + n.toString().length) - 16) + n;
}

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

function sopKey(s, o, p) {
  return `$l/sop/${s}:${o}:${p}`;
}

function spoKey(s, p, o) {
  return `$l/spo/${s}:${p}:${o}`;
}

function psoKey(p, s, o) {
  return `$l/pso/${p}:${s}:${o}`;
}

function posKey(p, o, s) {
  return `$l/pos/${p}:${o}:${s}`;
}

function opsKey(o, p, s) {
  return `$l/ops/${o}:${p}:${s}`;
}

function ospKey(o, s, p) {
  return `$l/osp/${o}:${s}:${p}`;
}

function scanAllDocuments(db, table) {
  const key = docLatestBaseKey(table);
  return db.createReadStream({ gte: key, lt: key + '~' });
}

function scanAllIndexKeys(db, schema, indexName) {
  const key = indexBaseKey(schema.name, indexName);
  return db.createKeyStream({ gte: key, lt: key + '~' });
}

function transformer(fn) {
  return new Transform({ objectMode: true, transform: fn });
}

function dropIndex(db, schema, indexName) {
  return scanAllIndexKeys(db, schema, indexName)
    .pipe(transformer((key, encoding, done) =>
       done(null, { type: 'del', key })));
}

function indexAllDocuments(db, schema, indexes = null) {
  return scanAllDocuments(db, schema.name)
    .pipe(transformer(function (data, enc, done) {
      const doc = JSON.parse(data.value);
      if(!doc) return done();
      indexDocument(db, schema, doc, indexes)
        .then((ops) => ops.map((op) => this.push(op)))
        .then((ops) => done());
    }));
}

async function unindexDocument(db, schema, doc, indexes = null) {
  return (await generateIndexKeys(db, schema, doc, indexes)).map((data) => 
    ({ type: 'del', ...data }));
}

//TODO: run the validator after indexing has taken place otherwise we
//      are doing the same thing twice and it is a performance hit
async function indexDocument(db, schema, doc, indexes = null) {
  await validateIndexOp(db, schema, doc, indexes);
  return (await generateIndexKeys(db, schema, doc, indexes)).map((data) => 
    ({ type: 'put', ...data }));
}

async function validateIndexOp(db, schema, doc, indexes = null) {
  return Promise.all((indexes || Object.keys(schema.indexes)).map(async (name) => { 
    if(schema.indexes[name].unique === true) {
      const keys = await invokeIndexer(db, schema, name, doc);
      return Promise.all(keys.map(async (data) => 
        validateUniqueKey(db, data.key, doc)));
    }
  }));
}

async function validateUniqueKey(db, key, doc) {
  let id;
  try {
    id = await db.get(key);
  } catch (err) {
    return true;
  }
  if(doc._id !== id)
    throw new Error(`Duplicate key '${key}'`);
}

function generateIndexKeys(db, schema, doc, indexes = null) {
  return Promise.all((indexes || Object.keys(schema.indexes)).map((name) => 
    invokeIndexer(db, schema, name, doc))).then(_.flattenDeep);
}

function invokeIndexer(db, schema, name, doc) {
  return db.indexers[schema.indexes[name].type]
    (db, schema, name, schema.indexes[name], doc);
}

function defaultIndexer(db, schema, name, options, doc) {
  return [{ key: indexKey(schema.name, name, 
    options.fields.map((field) => 
      jmespath.search(doc, field) || 'NULL').join('&'), 
    !options.unique && doc._id), value: doc._id }]; 
}

function linkIndexer(db, schema, name, options, doc) {
  const s = doc._id;
  const p = options.fields[0];
  const o = 'object._id';
  const spo = JSON.stringify({ s, p, o });
  return [
    { key: sopKey(s, o, p), value: spo },
    { key: spoKey(s, p, o), value: spo },
    { key: psoKey(p, s, o), value: spo }, 
    { key: posKey(p, o, s), value: spo },
    { key: opsKey(o, p, s), value: spo }, 
    { key: ospKey(o, s, p), value: spo }
  ];
}

function tokenize(text) {
  return _.uniq(text.split(tokenizer)
    .map(token => token.toLowerCase())
    .map(natural.PorterStemmer.stem)
    .filter(Boolean));
}

function invertedIndexer(db, schema, name, options, doc) {
  return options.fields.map((field) => {
    let text = jmespath.search(doc, field);
    if(typeof text !== 'string' && text) {
      text = JSON.stringify(text);
    }
    return tokenize(text || '').map((term) =>
      ({ key: indexKey(schema.name, name, term, doc._id), value: doc._id }));
  });
}

function migrate(db, p, c) {
  return new Promise((resolve, reject) => {
    const dropBatch = db.batch();
    const createBatch = db.batch();
    const end = async () => {
      await dropBatch.write();
      await createBatch.write();
    };
    createMigrationStream(db, p, c)
      .on('error', reject)
      .on('end', end)
      .on('close', end)
      .on('data', (data) => {
        if(data.type === 'put') {
          createBatch.put(data.key, data.value);
        } else if(data.type === 'del') {
          dropBatch.del(data.key);
        }  
      });
  });
}

function createMigrationStream(db, p, c) {
  const streams = mergeStream();
  const diff = diffSchema(p, c);
  const create = [];

  diff.forEach((op) =>
    op.type === 'dropIndex' ?
      streams.add(dropIndex(db, p, op.index)):
      create.push(op.index));

  if(create.length) {
    streams.add(indexAllDocuments(db, c, create));
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

function queryDocuments(db, query) {
  const result = parseFilter(db, query, query.filter);
  if(result.type === 'index') {
    // TODO
  } else {
    return scanAllDocuments(db, query.table)
      .pipe(transformer((data, enc, done) => {
        const doc = JSON.parse(data.value);
        if(!doc) return done();
      }));
  }
}

function parseFilter(db, query, filter) {
  switch(query.filter.type) {
    case 'union':
      break;
    case 'intersection':
      break;
    case 'eq':
    case 'neq':
    case 'gt':
    case 'gte':
    case 'lt':
    case 'lte':
    case 'match':
    case 'search':
    case 'within':
    case 'without':
      return findIndexer(db, query, filter);
  }
}

function findIndexer(db, query, filter) {
  const indexer = db.filters[filter.type];
  const indexes = db.schemas[query.table].indexes;
  const indexName = Object.keys(indexes).find((name) => 
    indexes[name].fields[0] === filter.field);
  return indexName ?
    { type: 'index', indexer: indexer[1] }:
    { type: 'scan', indexer: indexer[0] };
}

function docEq(db, doc, field, value) {
  return Promise.resolve(jmespath.search(doc, field) === value);
}

function indexEq(db, index, value) {
  const key = index + ':' + value;
  return db.createReadStream({ gte: key + ':', lte: key + '~' });
}

function docNeq(db, doc, field, value) {
  return Promise.resolve(jmespath.search(doc, field) !== value);
}

function indexNeq(db, index, value) {
  return mergeStream(db.createReadStream({
    gt: index + ':',
    lt: index + ':' + value
  }), db.createReadStream({
    gt: index + ':' + value,
    lt: index + ':~'
  }));
}

function docGt(db, doc, field, value) {
  return Promise.resolve(jmespath.search(doc, field) > value);
}

function indexGt(db, index, value) {
  return db.createReadStream({ gt: index + ':' + value });
}

function docGte(db, doc, field, value) {
  return Promise.resolve(jmespath.search(doc, field) >= value);
}

function indexGte(db, index, value) {
  return db.createReadStream({ gte: index + ':' + value });
}

function docLt(db, doc, field, value) {
  return Promise.resolve(jmespath.search(doc, field) < value);
}

function indexLt(db, index, value) {
  return db.createReadStream({ lt: index + ':' + value });
}

function docLte(db, doc, field, value) {
  return Promise.resolve(jmespath.search(doc, field) <= value);
}

function indexLte(db, index, value) {
  return db.createReadStream({ lte: index + ':' + value });
}

// value must be a RegExp object
function docMatch(db, doc, field, value) {
  return Promise.resolve(value.test(jmespath.search(doc, field)));
}

function docSearch(db, doc, field, value) {
  let text = jmespath.search(doc, field);
  if(typeof text !== 'string') {
    text = JSON.stringify(text);
  }
  const docTokens = tokenize(text);
  const valTokens = tokenize(text);
  // are vaTokens all inside docTokens?
}

// add a match all or match any option
function indexSearch(db, index, values) {
  const key = index + ':';
  return mergeStream(...tokenize(values).map((token) =>
    db.createReadStream({ gte: key + token, lte: key + token })));
}

function docWithin(db, doc, field, start, end) {
  const field = jmespath.search(doc, field);
  return Promise.resolve(field >= start && field <= end);
}

function indexWithin(db, index, start, end) {
  const key = index + ':';
  return db.createReadStream({ gte: key + start, lte: key + end });
}

function docWithout(db, doc, field, start, end) {
  const field = jmespath.search(doc, field);
  return Promise.resolve(field < start || field > end);
}

function indexWithout(db, index, start, end) {
  return mergeStream(db.createReadStream({
    gt: index + ':',
    lt: index + ':' + start
  }), db.createReadStream({
    gt: index + ':' + end,
    lt: index + ':~'
  }));
}

/*
{
  table: 'Entity',
  filter: {
    type: 'intersection',
    expressions: [
      { type: 'eq', field: 'name', value: 'James' }, 
      { type: 'gt', field: 'name', value: 'James' }, 
      { type: 'lt', field: 'name', value: 'James' }, 
      { type: 'match', field: 'name', value: '.*' },
      { type: 'union', expressions: [{
        { type: 'eq', field: 'name', value: 'James' }, 
        { type: 'gt', field: 'name', value: 'James' }, 
        { type: 'lt', field: 'name', value: 'James' }, 
        { type: 'match', field: 'name', value: '.*' },
      }] },
    ]
  }],
  projections: [{
    field: 'comments',
    query: {
      table: 'Comment',
      filter: [],
      projections: [{
        field: 'authors',
        table: 'User',
        filter: []
      }]
    }
  }]
  distinct: ['name', 'age'],
  order: { fields: ['name', 'age'], dir: 'ASC' },
  offset: 0,
  limit: 100
}
*/
const db = require('level')('/tmp/test-db');
db.indexers = {};
db.indexers.default = defaultIndexer; 
db.indexers.inverted = invertedIndexer; 
db.indexers.link = linkIndexer; 
db.filters = {};
db.filters.gt = [docGt, indexGt];
db.filters.gte = [docGte, indexGte];
db.filters.lt = [docLt, indexLt];
db.filters.lte = [docLte, indexLte];
db.filters.eq = [docEq, indexEq];
db.filters.neq = [docNeq, indexNeq];
db.filters.match = [docMatch];
db.filters.search = [docSearch, indexSearch];
db.filters.within = [docWithin, indexWithin];
db.filters.without = [docWithout, indexWithout];
db.schemas = {};
db.schemas.User = {
  name: 'User',
  indexes: {
    name: { type: 'default', fields: ['name'] },
    email: { type: 'default', fields: ['email'], unique: true },
    text: { type: 'inverted', fields: ['text'] },
    friends: { type: 'link', fields: ['friends'], table: 'User', indexes: [
      'name', 'text'
    ] }
  }
};

const userSchema2 = {
  name: 'User',
  indexes: {
    name: { type: 'default', fields: ['name'] },
    email: { type: 'default', fields: ['email'] },
    tagline: { type: 'default', fields: ['tagline'] },
    bio: { type: 'inverted', fields: ['bio'] },
    text: { type: 'inverted', fields: ['text'] },
    friends: { type: 'link', fields: ['friends'], table: 'User', indexes: [
      'name', 'text'
    ] }
  }
};

const diff = diffSchema(db.schemas.User, userSchema2);
assert.ok(diff.length === 4);
assert.ok(diff[0].type === 'dropIndex');
assert.ok(diff[0].table === 'User');
assert.ok(diff[0].index === 'email');
assert.ok(diff[1].type === 'createIndex');
assert.ok(diff[1].table === 'User');
assert.ok(diff[1].index === 'email');
assert.ok(diff[2].type === 'createIndex');
assert.ok(diff[2].table === 'User');
assert.ok(diff[2].index === 'tagline');
assert.ok(diff[3].type === 'createIndex');
assert.ok(diff[3].table === 'User');
assert.ok(diff[3].index === 'bio');

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
  assert.ok(indexes.length === 8);
  await delDocument(db, 'User', ids[0]);
  const delDoc = await getDocument(db, 'User', ids[0]);
  assert.ok(!delDoc);
  
  queryDocuments(db, { 
    table: 'User', 
    filter: { 
      type: 'eq', field: 'name', value: 'Jameson1'
    }
  })
  //.on('data', console.log);
  
  //createMigrationStream(db, db.schemas['User'], userSchema2)
    //.on('data', console.log);
});
indexDocument(db, db.schemas.User, { _id: '1', name: 'James', email: 'jgunn987999@gmail.com', text: 'one two' })
  .then((keys) => {
    assert.ok(keys.length === 10);
    assert.ok(keys[0].type === 'put');
    assert.ok(keys[0].key === '%User/$i/name:James:1');
    assert.ok(keys[0].value === '1');
    assert.ok(keys[1].type === 'put');
    assert.ok(keys[1].key === '%User/$i/email:jgunn987999@gmail.com');
    assert.ok(keys[1].value === '1');
  });
