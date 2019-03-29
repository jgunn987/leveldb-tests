const jmespath = require('jmespath');
const uuid = require('uuid');
const _ = require('lodash');
const mergeStream = require('merge-stream');
const { Transform } = require('stream');
const EventEmitter = require('events');
const natural = require('natural');
const tokenizer = /[\W\d]+/;
const vm = require('vm');
const esprima = require('esprima');

function deconsLinkQuery(s) {
  return s.length < 3 ? [] : [s.slice(0, 3)].concat(
    deconsLinkQuery(s.slice(2)));
}

console.log(deconsLinkQuery([
  'Person', 'eats', 'Food', 'from', 'Country'
]));

function compareFunctions(a, b) {
  return _.isEqual(esprima.parse(a), esprima.parse(b));
}

function compileFn(fn, context) {
  return new vm.Script(fn).runInContext(context);
}

function tokenize(text) {
  return _.uniq(text.split(tokenizer)
    .map(token => token.toLowerCase())
    .map(natural.PorterStemmer.stem)
    .filter(Boolean));
}

function stringifyFieldRef(doc, field) {
  return JSON.stringify(jmespath.search(doc, field) || '');
}

function tid(n) {
  return +new Date() + ("0000000000000000")
    .substr((16 + n.toString().length) - 16) + n;
}

function createDoc(doc) {
  return { 
    _id: doc._id || uuid.v4(), 
    _v: (+new Date()).toString(),
    _links: doc._links || { put: [], del: [] },
    ...doc
  };
}

function createSchema(schema) {
  return { 
    name: schema.name || '', 
    indexes: schema.indexes || {},
    _v: (+new Date()).toString(),
  };
}

function metadataKey() {
  return `#metadata`;
}

function schemaLatestKey(table) {
  return `%${table}/$schema`;
}

function schemaKey(table, version) {
  return `${schemaLatestKey(table)}:${version}`;
}
  
function indexBaseKey(table, indexName) {
  return `%${table}/$i/${indexName}`;
}

function indexKey(table, indexName, value, uuid) {
  return `${indexBaseKey(table, indexName)}:${value}` + (uuid ? ':' + uuid : '');
}

function docLatestBaseKey(table) {
  return `%${table}:`;
}

function docLatestKey(table, uuid) {
  return `${docLatestBaseKey(table)}${uuid}`;
}
  
function docKey(table, uuid, version) {
  return `%${table}/$v/${version}:${uuid}`;
}

function linkKeyFirst(register, s) {
  return `@${register}/${s}`;
}

function linkKeyFirstSecond(register, s, p) {
  return `${linkKeyFirst(register, s)}-${p}`;
}

function linkKey(register, s, p, o) {
  return `${linkKeyFirstSecond(register, s, p)}-${o}`;
}

function createLinkOps(s, p, o, data) {
  const spo = { s, p, o, ...data };
  const value = JSON.stringify(spo);
  return createLinkKeys(spo).map(key => ({ key, value }));
}

function createLinkKeys({ s, p, o }) {
  return [
    linkKey('sop', s, o, p), 
    linkKey('spo', s, p, o),
    linkKey('pso', p, s, o), 
    linkKey('pos', p, o, s),
    linkKey('ops', o, p, s), 
    linkKey('osp', o, s, p)
  ];
}

function transformer(fn) {
  return new Transform({ objectMode: true, transform: fn });
}

function batchStream(db, stream) {
  return stream.hasOwnProperty('isEmpty') && stream.isEmpty() ?
    Promise.resolve([]):
    new Promise((resolve, reject) => {
      const batch = [];
      stream.on('data', data => batch.push(data))
        .on('end', () => resolve(batch))
        .on('error', reject);
    });
}

function dropIndex(db, schema, indexName) {
  return scanAllIndexKeys(db, schema, indexName)
    .pipe(transformer((key, encoding, done) =>
       done(null, { type: 'del', key })));
}

function scanAllIndexKeys(db, schema, indexName) {
  const key = indexBaseKey(schema.name, indexName);
  return db.db.createKeyStream({ gte: key, lt: key + '~' });
}

function indexAllDocs(db, schema, indexes = null) {
  return scanAllDocs(db, schema.name)
    .pipe(transformer(function (data, enc, done) {
      const value = JSON.parse(data.value);
      if(!value) return done();
      indexDoc(db, schema, createDoc(value), indexes)
        .then(ops => ops.map(op => this.push(op)))
        .then(ops => done());
    }));
}

function scanAllDocs(db, table) {
  const key = docLatestBaseKey(table);
  return db.db.createReadStream({ gte: key, lt: key + '~' });
}

async function unindexDoc(db, schema, doc, indexes = null) {
  return (await generateIndexKeys(db, schema, doc, indexes))
    .map(data => ({ type: 'del', ...data }));
}

async function dropAllDocLinks(db, schema, doc) {
  return batchStream(db,
    getConnectedLinksStreams(db, schema, doc)
      .pipe(transformer(function (data, enc, done) {
        createLinkKeys(JSON.parse(data.value))
          .forEach(key => this.push({ type: 'del', key }));
        done();
      })));
}

function getConnectedLinksStreams(db, schema, doc) {
  return mergeStream(
    getLinkStream(db, schema, doc, 'spo'),
    getLinkStream(db, schema, doc, 'ops'));
}

function getLinkStream(db, schema, doc, register) {
  const key = linkKeyFirst(register, `${schema.name}:${doc._id}`); 
  return db.db.createReadStream({ gte: key, lte: key + '~' });
}

async function indexDoc(db, schema, doc, indexes = null) {
  await validateIndexOp(db, schema, doc, indexes);
  return (await generateIndexKeys(db, schema, doc, indexes))
    .map((data) => ({ type: 'put', ...data }))
    .concat(indexDocLinks(db, schema, doc));
}

function indexDocLinks(db, schema, doc) {
  return indexDocOpLinks(db, schema, doc, 'put')
    .concat(indexDocOpLinks(db, schema, doc, 'del'));
}

function indexDocOpLinks(db, schema, doc, type) {
  return _.flatten(doc._links[type].map(link => 
    link[0] && link[1] ? 
      createLinkOps(schema.name + ':' + doc._id, link[0], link[1], link[2] || {})
        .map(key => ({ type, ...key })) : undefined));
}

async function validateIndexOp(db, schema, doc, indexes = null) {
  return Promise.all((indexes || Object.keys(schema.indexes)).map(async name => { 
    if(schema.indexes[name].unique === true) {
      const keys = await invokeIndexer(db, schema, name, doc);
      return Promise.all(keys.map(async data => 
        validateUniqueKey(db, data.key, doc)));
    }
  }));
}

async function validateUniqueKey(db, key, doc) {
  let id;
  try {
    id = await db.db.get(key);
  } catch (err) {
    return true;
  }
  if(doc._id !== id)
    throw new Error(`duplicate key '${key}'`);
}

function generateIndexKeys(db, schema, doc, indexes = null) {
  return Promise.all((indexes || Object.keys(schema.indexes)).map(name => 
    invokeIndexer(db, schema, name, doc))).then(_.flattenDeep);
}

function invokeIndexer(db, schema, name, doc) {
  const indexer = db.indexers[schema.indexes[name].type];
  return indexer ? indexer(db, schema, name, schema.indexes[name], doc) : [];
}

function defaultIndexer(db, schema, name, options, doc) {
  const fields = options.fields.map(f => jmespath.search(doc, f) || 'NULL').join('&');
  return [{ 
    key: indexKey(schema.name, name, fields, !options.unique && doc._id), 
    value: docLatestKey(schema.name, doc._id)
  }]; 
}

function invertedIndexer(db, schema, name, options, doc) {
  return options.fields.map(field => {
    return tokenize(stringifyFieldRef(doc, field)).map(term =>
      ({ key: indexKey(schema.name, name, term, doc._id), value: doc._id }));
  });
}

function linkIndexer(db, schema, name, options, doc) { return []; }

async function runMigration(db, p, c) {
  return db.db.batch([
    ...await runDropStream(db, p, c),
    ...await runCreateStream(db, p, c)
  ]);
}

function runDropStream(db, p, c) {
  return batchStream(db, mergeStream(compareIndices(p, c)
    .map(index => dropIndex(db, p, index))));
}

function runCreateStream(db, p, c) {
  return batchStream(db, indexAllDocs(db, c, compareIndices(c, p)));
}

function compareIndices(a, b) {
  return Object.keys(a.indexes).map(index =>
    !_.isEqual(a.indexes[index], b.indexes[index]) && index).filter(Boolean);
}

async function put(db, table, doc) {
  const schema = createSchema(db.schemas[table]);
  const newDoc = createDoc(doc);
  const value = JSON.stringify(newDoc);
  await db.db.batch([
    ...await indexDoc(db, schema, newDoc), 
    { type: 'put', key: docLatestKey(table, newDoc._id), value },
    { type: 'put', key: docKey(table, newDoc._id, newDoc._v), value }
  ]);
  return newDoc._id;
}

async function get(db, table, uuid, version) {
  return JSON.parse(version ?
    await db.db.get(docKey(table, uuid, version)):
    await db.db.get(docLatestKey(table, uuid)));
}

async function del(db, table, uuid) {
  const doc = await get(db, table, uuid);
  return await db.db.batch([
    ...await unindexDoc(db, db.schemas[table], doc), 
    ...await dropAllDocLinks(db, db.schemas[table], doc),
    { type: 'put', key: docLatestKey(table, doc._id), value: 'null' }
  ]);
}

function or(schema, f) {
  const parsed = f.expressions.map(e => parseFilter(schema, e));
  return [makeInMemOrClosure(parsed),
         makeIndexOrStream(parsed)];
}

function makeInMemOrClosure(parsedExpressions) {
  return async function (db, doc) {
    const length = parsedExpressions.length;
    for(let i=0; i < length; ++i)
      if(await parsedExpressions[i][0](db, doc))
        return true;
    return false;
  };
}

function makeIndexOrStream(parsedExpressions) {
  const withoutStream = parsedExpressions.find(e => !e[1]);
  return !withoutStream ? function (db) {
    const seen = new Set();
    return mergeStream(parsedExpressions.map(e => e[1](db)))
      .pipe(transformer(function (data, enc, done) {
        if(!set.has(data)) {
          set.add(data);
          this.push(data);
        }
        done();
      }));
    return stream;
  } : undefined;
}

function and(schema, f) {
  const parsed = f.expressions.map(e => parseFilter(schema, e));
  const compound = findCompoundIndex(schema, f.expressions);
  const inmem = makeInMemAndClosure(parsed);
  return compound ?
    [inmem, makeIndexClosure(indexEq, compound)]:
    [inmem, makeIndexAndStream(parsed, inmem)];
}

function makeInMemAndClosure(parsedExpressions) {
  return async function (db, doc) {
    const length = parsedExpressions.length;
    for(let i=0; i < length; ++i)
      if(!await parsedExpressions[i][0](db, doc))
        return false;
    return true;
  };
}

function makeIndexAndStream(parsedExpressions, inmemPipeline) {
  const withStream = parsedExpressions.find(e => e[1]);
  return withStream ? function (db) {
    withStream[0](db)
      .pipe(transformer(async function (data, enc, done) {
        const parsed = JSON.parse(data);
        const doc = typeof data === 'string' ?
          await db.db.get(data) : data;
        if(await inmemPipeline(db, doc)) this.push(doc);
        done();
      }));
  } : undefined;
}

function eq(schema, f) {
  const indexes = findIndexes(schema, f.field); 
  const key = indexBaseKey(schema.name, indexes[0]);
  return indexes.length ? [
    makeInMemClosure(docEq, f.field, f.value), 
    makeIndexClosure(indexEq, key, f.value)
  ] : [makeInMemClosure(docEq, f.field, f.value)];
}

function makeInMemClosure(fn, field, ...values) {
  return (db, doc) => fn(db, doc, field, ...values);
}

function makeIndexClosure(fn, key, ...values) {
  return (db) => fn(db, key, ...values);
}

const filters = { and, or, eq };

function parseFilter(schema, f) {
  const filter = filters[f.type];
  return filter ? filter(schema, f) : eq(schema, f);
}

function findCompoundIndex(schema, filters, type = 'default') {
  const names = filters.map(f => f.field).sort();
  return filters.find(f => f.type === 'eq') ?
    Object.keys(schema.indexes)
      .filter(name => {
        const index = schema.indexes[name];
        return index.type === type &&
          _.isEqual(names, (index.fields || []).sort())
      })[0] : undefined;
}

function findIndexes(schema, field, type = 'default') {
  return Object.keys(schema.indexes)
    .filter(name => {
      const index = schema.indexes[name];
      const fields = index.fields || [];
      return fields.indexOf(field) !== -1 && 
        index.type === type &&
        fields.length === 1;
    });
}

function parseQuery(schema, q) {
  return parseFilter(schema, q.filter);
}

function query(db, q) {
  const table = q.table;
  const parsed = parseQuery(db.schemas[table], q);
  const result = !parsed[1] ? 
    queryScanTable(db, table, parsed[0]):
    queryScanIndex(db, parsed[1]);
  return result;
}

function queryScanTable(db, table, eval) {
  return new Promise((resolve, reject) => {
    const results = [];
    scanAllDocs(db, table)
      .on('error', reject)
      .on('end', () => 
        Promise.all(results)
          .then(r => r.filter(Boolean))
          .then(resolve))
      .on('data', data =>
        results.push(evaluate(db, JSON.parse(data.value), eval)));
  });
}

async function evaluate(db, doc, eval) {
  return await eval(db, doc) && doc;
}

function queryScanIndex(db, indexStream) {
  return new Promise((resolve, reject) => {
    const results = [];
    indexStream(db)
      .on('error', reject)
      .on('end', () => resolvePointers(db, results).then(resolve))
      .on('data', data => {
        results.push(data.value);
      });
  });
} 

function resolvePointers(db, results) {
  return Promise.all(results.map(r => typeof r === 'string' ? db.db.get(r) : r))
    .then(r => r.map(JSON.parse));
}

function docEq(db, doc, field, value) {
  return Promise.resolve(jmespath.search(doc, field) === value);
}

function indexEq(db, index, value) {
  const key = index + ':' + value;
  return db.db.createReadStream({ gte: key + ':', lte: key + '~' });
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

function docMatch(db, doc, field, value) {
  return Promise.resolve(value.test(jmespath.search(doc, field)));
}

function docSearch(db, doc, field, value) {
  const docTokens = tokenize(stringifyFieldRef(doc, field));
  const valTokens = tokenize(value);
  return Promise.resolve(!!valTokens.find(t => !docTokens.includes(t)));
}

function indexSearch(db, index, values) {
  const key = index + ':';
  return mergeStream(...tokenize(values).map(token =>
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

async function loadMetadata(db) {
  try {
    db.metadata = JSON.parse(await db.db.get(metadataKey()));
  } catch (err) {
    db.metadata = { tables: [] };
  }
  return db;
}

async function saveMetadata(db) {
  try {
    await db.db.put(metadataKey(),
      JSON.stringify(db.metadata));
  } catch (err) {
    throw new Error(`could not save system metadata`);
  }
  return db;
}

async function loadSchemas(db) {
  await Promise.all(db.metadata.tables.map(t => db.loadSchema(db, t)));
  return db;
}

async function loadSchema(db, table) {
  try {
    db.schemas[table] = 
      JSON.parse(await db.db.get(schemaLatestKey(table)));
  } catch (err) {
    throw new Error(`schema not found for table '${t}'`);
  }
  return db; 
}

async function saveSchema(db, schema) {
  try {
    const data = JSON.stringify(schema);
    await db.db.batch([
      { type: 'put', key: schemaLatestKey(schema.name), data },
      { type: 'put', key: schemaKey(schema.name, schema._v), data }
    ]);
  } catch(err) {
    throw new Error(`failed to save schema for table '${schema.table}'`);
  }
  return db; 
}

class DB extends EventEmitter {
  constructor(db) {
    super();
    this.db = db;
    this.metadata = {};
    this.schemas = {};
    this.indexers = {
      default: defaultIndexer,
      inverted: invertedIndexer,
      link: linkIndexer
    };
    this.init();
  }

  async init() {
    await loadMetadata(this);
    await loadSchemas(this);
    await saveMetadata(this);
    this.emit('init');
  }

  async migrate(schema) {
    const candidate = createSchema(schema);
    const existing = createSchema(this.schemas[candidate.name] || {});
    const name = candidate.name;

    try {
      await runMigration(this, existing, candidate);
    } catch(err) {
      throw new Error(`failed to migrate table '${name}'`);
    }

    await saveSchema(this, candidate);
    this.schemas[name] = candidate;
    this.metadata.tables.push(name);
    this.metadata.tables = _.uniq(this.metadata.tables);
    return saveMetadata(this);
  }

  async get(table, id, version = null) {
    try {
      const value = await get(this, table, id, version);
      if(!value) throw value;
      return value;
    } catch (err) {
      throw new Error(`unable to find document by id '${id}' from table '${table}'`);
    }
  }
  
  async put(table, doc) {
    try {
      return put(this, table, doc);
    } catch(err) {
      throw new Error(`unable to save document to table '${table}'`);
    }
  }

  async del(table, id) {
    try {
      return del(this, table, id);
    } catch(err) {
      throw new Error(`unable to delete document with id '${id}' from table '${table}'`);
    }
  }

  async query(q) {
    try {
      return query(this, q);
    } catch (err) {
      throw new Error(`error executing query on table '${q.table}'`);
    }
  }
}

module.exports = db => new DB(db);
