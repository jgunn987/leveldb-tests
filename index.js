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
    $links: doc.$links || { put: [], del: [] },
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

function createLinkOps(s, p, o, data) {
  const spo = JSON.stringify({ s, p, o, ...data });
  return [
    { key: sopKey(s, o, p), value: spo },
    { key: spoKey(s, p, o), value: spo },
    { key: psoKey(p, s, o), value: spo }, 
    { key: posKey(p, o, s), value: spo },
    { key: opsKey(o, p, s), value: spo }, 
    { key: ospKey(o, s, p), value: spo }
  ];
}

function createLinkKeys(s, p, o) {
  return [
    sopKey(s, o, p),
    spoKey(s, p, o),
    psoKey(p, s, o),
    posKey(p, o, s),
    opsKey(o, p, s),
    ospKey(o, s, p)
  ];
}

function metadataKey() {
  return `#metadata`;
}

function schemaLatestKey(table) {
  return `%${table}/$schema/latest`;
}

function schemaKey(table, version) {
  return `%${table}/$schema:${version}`;
}
  
function indexBaseKey(table, indexName) {
  return `%${table}/$i/${indexName}`;
}

function docLatestBaseKey(table) {
  return `%${table}/$latest`;
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
  return `@sop/${s}-${o}-${p}`;
}

function spoKey(s, p, o) {
  return `@spo/${s}-${p}-${o}`;
}

function psoKey(p, s, o) {
  return `@pso/${p}-${s}-${o}`;
}

function posKey(p, o, s) {
  return `@pos/${p}-${o}-${s}`;
}

function opsKey(o, p, s) {
  return `@ops/${o}-${p}-${s}`;
}

function ospKey(o, s, p) {
  return `@osp/${o}-${s}-${p}`;
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
        const spo = JSON.parse(data.value);
        createLinkKeys(spo.s, spo.p, spo.o)
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
  const key = '@' + register + '/' + schema.name + ':' + doc._id;
  return db.db.createReadStream({ gte: key, lte: key + '~' });
}

//TODO: run the validator after indexing has taken place otherwise we
//      are doing the same thing twice and it is a performance hit
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
  return _.flatten(doc.$links[type].map(link => 
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
  return [{ key: indexKey(schema.name, name, options.fields
      .map(field => jmespath.search(doc, field) || 'NULL').join('&'), 
    !options.unique && doc._id), value: doc._id }]; 
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

function compareIndices(a, b, action) {
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

// query functions
// ---------------

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

// we need to hold a central set of all results
// run every index in parallel and aggregate the results
// as a set union. 
// if there is one expression in the chain that doesn't have
// an index then we need to run a full scan, which means we dont run
// any index scans we run all through memory
function makeIndexOrStream(parsedExpresions) {
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
  return compound ?
    [makeInMemAndClosure(parsed), 
     makeIndexClosure(indexEq, compound)]:
    [makeInMemAndClosure(parsed),
     makeIndexAndStream(parsed)];
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

// we can get away without a full scan if we have at least one index
// as our resulting set will have to be in that index.
// once scanned, we individually fetch the documents
// for all in that index and run through the in memory evaluators
function makeIndexAndStream(parsedExpressions) {
  const withStream = parsedExpressions.find(e => e[1]);
  return withStream ? function (db) {
    withStream[0](db).on('data', data => {
        
    });
  } : undefined;
}

function eq(schema, f) {
  const indexes = findIndexes(schema, f.field); 
  return indexes.length ? [
    makeInMemClosure(docEq, f.field, f.value), 
    makeIndexClosure(indexEq, indexes[0])
  ] : [makeInMemClosure(docEq, f.field, f.value)];
}

function makeInMemClosure(fn, field, ...values) {
  return (db, doc) => fn(db, doc, field, ...values);
}

function makeIndexClosure(fn, index, ...values) {
  return (db) => fn(db, index, ...values);
}

// each filter returns an optional index based stream
// and an in memory lambda. If no stream is present
// then a full scan of the table will be chosen and
// all filters will run thier in memory lambdas
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
  return parseFilter(schema, q);
}

// * get schema for query
// * parse filters
// * parse projections
// * run main table query
// * sort and limit main query
// * run projection queries 
// * sort and limit projection queries
// * return results;
function query(db, q) {
  return parseQuery(db.schemas[q.table], q);
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
  const docTokens = tokenize(stringifyFieldRef(doc, field));
  const valTokens = tokenize(value);
  // are vaTokens all inside docTokens?
}

// add a match all or match any option
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
  db.metadata.tables.forEach(async t =>
    await db.loadSchema(db, t));
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
    const exisiting = createSchema(this.schemas[candidate.name] || {});
    const name = candidate.name;
    
    try {
      await runMigration(this, exisiting, candidate);
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
      throw new Error(`Error executing query on table '${q.table}'`);
    }
  }
}

module.exports = db => new DB(db);
