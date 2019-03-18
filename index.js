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

function dropIndex(db, schema, indexName) {
  return scanAllIndexKeys(db, schema, indexName)
    .pipe(transformer((key, encoding, done) =>
       done(null, { type: 'del', key })));
}

function scanAllIndexKeys(db, schema, indexName) {
  const key = indexBaseKey(schema.name, indexName);
  return db.createKeyStream({ gte: key, lt: key + '~' });
}

function indexAllDocuments(db, schema, indexes = null) {
  return scanAllDocuments(db, schema.name)
    .pipe(transformer(function (data, enc, done) {
      indexDocument(db, schema, createDoc(JSON.parse(doc)), indexes)
        .then(ops => ops.map(op => this.push(op)))
        .then(ops => done());
    }));
}

function scanAllDocuments(db, table) {
  const key = docLatestBaseKey(table);
  return db.createReadStream({ gte: key, lt: key + '~' });
}

async function unindexDocument(db, schema, doc, indexes = null) {
  return (await generateIndexKeys(db, schema, doc, indexes))
    .map(data => ({ type: 'del', ...data }));
}

async function dropAllDocLinks(db, schema, doc) {
  return new Promise((resolve, reject) => {
    const batch = [];
    getConnectedLinksStream(db, schema, doc)
      .pipe(transformer(function (data, enc, done) {
        const spo = JSON.parse(data.value);
        createLinkKeys(spo.s, spo.p, spo.o)
          .forEach(key => this.push({ type: 'del', key }));
        done();
      })).on('error', reject)
        .on('end', resolve(batch))
        .on('data', data => batch.push(data));
  });
}

function getConnectedLinksStreams(db, schema, doc) {
  return mergeStream(
    getLinkStream(db, schema, doc, 'spo'),
    getLinkStream(db, schema, doc, 'ops'));
}

function getLinkStream(db, schema, doc, register) {
  const key = '@' + register + '/' + schema.name + ':' + doc._id;
  return db.createReadStream({ gte: key, lte: key + '~' });
}

//TODO: run the validator after indexing has taken place otherwise we
//      are doing the same thing twice and it is a performance hit
async function indexDocument(db, schema, doc, indexes = null) {
  await validateIndexOp(db, schema, doc, indexes);
  return (await generateIndexKeys(db, schema, doc, indexes))
    .map((data) => ({ type: 'put', ...data }))
    .concat(indexDocumentLinks(db, schema, doc));
}

function indexDocumentLinks(db, schema, doc) {
  return indexDocumentOpLinks(db, schema, doc, 'put')
    .concat(indexDocumentOpLinks(db, schema, doc, 'del'));
}

function indexDocumentOpLinks(db, schema, doc, type) {
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
    id = await db.get(key);
  } catch (err) {
    return true;
  }
  if(doc._id !== id)
    throw new Error(`Duplicate key '${key}'`);
}

function generateIndexKeys(db, schema, doc, indexes = null) {
  return Promise.all((indexes || Object.keys(schema.indexes)).map(name => 
    invokeIndexer(db, schema, name, doc))).then(_.flattenDeep);
}

function invokeIndexer(db, schema, name, doc) {
  return db.indexers[schema.indexes[name].type]
    (db, schema, name, schema.indexes[name], doc);
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

function linkIndexer(db, schema, name, options, doc) {
  return [];
}

async function runMigration(db, p, c) {
  await runDropStream(db, p, c);
  await runCreateStream(db, p, c);
}

function runDropStream(db, p, c) {
  return batchStream(db, mergeStream(compareIndices(p, c)
    .map(index => dropIndex(db, p, index))));
}

function runCreateStream(db, p, c) {
  return batchStream(db, indexAllDocuments(db, c, compareIndices(c, p)));
}

function batchStream(db, stream) {
  if(stream.hasOwnProperty('isEmpty') && stream.isEmpty()) {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const batch = [];
    stream.on('data', data => batch.push(data))
      .on('end', () => resolve(db.batch(batch)))
      .on('error', reject);
  });
}

function compareIndices(a, b, action) {
  return Object.keys(a.indexes).map(index =>
    !_.isEqual(a.indexes[index], b.indexes[index]) && index).filter(Boolean);
}

async function putDocument(db, table, doc) {
  const schema = createSchema(db.schemas[table]);
  const newDoc = createDoc(doc);
  const value = JSON.stringify(newDoc);
  await db.batch([
    ...await indexDocument(db, schema, newDoc), 
    { type: 'put', key: docLatestKey(table, newDoc._id), value },
    { type: 'put', key: docKey(table, newDoc._id, newDoc._v), value }
  ]);
  return newDoc._id;
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
    ...await dropAllDocLinks(db, db.schemas[table], doc),
    { type: 'put', key: docLatestKey(table, doc._id), value: 'null' }
  ]);
}

function queryDocuments(db, query) {}

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

class DB extends EventEmitter {
  constructor(db) {
    super();
    this.db = db;
    this.metadata = {};
    this.schemas = {};
    this.init();
  }

  async init() {
    await this.loadMetadata();
    await this.loadSchemas();
    await this.saveMetadata();
    this.emit('init');
  }

  async loadMetadata() {
    try {
      this.metadata = JSON.parse(await this.db.get(metadataKey()));
    } catch (err) {
      this.metadata = { tables: [] };
    }
    return this;
  }

  async saveMetadata() {
    try {
      await this.db.put(metadataKey(),
        JSON.stringify(this.metadata));
    } catch (err) {
      throw new Error(`could not save system metadata`);
    }
    return this;
  }

  async loadSchemas() {
    this.metadata.tables.forEach(async t =>
      await this.loadSchema(t));
    return this;
  }

  async loadSchema(table) {
    try {
      this.schemas[table] = 
        JSON.parse(await this.db.get(schemaLatestKey(table)));
    } catch (err) {
      throw new Error(`schema not found for table '${t}'`);
    }
    return this; 
  }

  // TODO: create checkpoints for migration in the case of failure
  async migrate(schema) {
    const candidate = createSchema(schema);
    const exisiting = createSchema(this.schemas[candidate.name] || {});
    const name = candidate.name;
    
    try {
      await runMigration(this.db, exisiting, candidate);
    } catch(err) {
      throw new Error(`failed to migrate table ${name}`);
    }

    await this.saveSchema(candidate);
    this.schemas[name] = candidate;
    this.metadata.tables.push(name);
    this.metadata.tables = _.uniq(this.metadata.tables);
    return this.saveMetadata();
  }

  async saveSchema(schema) {
    try {
      const data = JSON.stringify(schema);
      await this.db.batch([
        { type: 'put', key: schemaLatestKey(schema.name), data },
        { type: 'put', key: schemaKey(schema.name, schema._v), data }
      ]);
    } catch(err) {
      throw new Error(`failed to save schema for table ${schema.table}`);
    }
    return this; 
  }

  async transaction() {}
  async get(table, id, version = null) {}
  async put(table, doc) {}
  async del(table, id) {}
  async query(q) {}
}

module.exports = db => new DB(db);
