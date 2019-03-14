const level = require('level');
const _ = require('lodash');
const keys = require('./keys');
const Indexer = require('./indexer');
const Schema = require('./schema');

class DB {
  constructor(db) {
    this.db = db;
    this.indexer = new Indexer(db);
    this.schemas = {};
  }

  async init() {
    await this.loadMetadata();
    await this.loadSchemas();
    return this;
  }

  async loadMetadata() {
    const key = keys.metadata();
    try {
      const metadata = await this.db.get(key);
      this.metadata = JSON.parse(metadata);
    } catch(err) {
      console.log('Could not find system metadata, initializing new');
      this.metadata = { tables: [] };
      await this.db.put(key, JSON.stringify(this.metadata));
    }
    return this;
  }

  async loadSchemas() {
    return Promise.all(this.metadata.tables.map(async (table) => {
      try {
        const key = keys.schemaLatest(table);
        const schema = await this.db.get(key);
        this.schemas[table] = JSON.parse(schema);
      } catch (err) {
        console.log(`Could not find schema for table "${table}"`);
      }
    }));
  }

  async putSchema(schema) {
    const name = schema.name;
    const existing = this.schemas[name];
    const ops = [];

    if(existing) {
      console.log(`Performing migration on table '${name}'`);
      ops.push(...await this.migrateSchema(existing, schema));
      console.log(`Migration complete on table '${name}'`);
    } else {
      console.log(`Creating new table '${name}'`);
      ops.push(...await this.createNewTable(schema));
      console.log(`Table '${name}' created`);
    }

    ops.push(...this.putNewSchemaVersion(schema));
    this.schemas[schema.name] = schema;
    this.metadata.tables.push(name);
    this.metadata.tables = 
      _.uniq(this.metadata.tables);
    ops.push(...this.putMetadata());
    await this.db.batch(ops);
    return this;
  }

  async migrateSchema(p, c) {
    return await Promise.all(Schema.diff(p, c).map(async (op) => {
      if(op.type === 'create') {
        return await this.indexer.create(c, op.index);
      } else if(op.type === 'drop') {
        return await this.indexer.drop(p, op.index);
      }
    })).then(_.flatten);
  }

  async createNewTable(schema) {
    return Promise.all(Object.keys(schema.indexes).map((name) =>
      this.indexer.create(schema, name))).then(_.flatten);
  }

  putNewSchemaVersion(schema) {
    schema._v = '00001';
    this.schemas[schema.name] = schema;
    const str = JSON.stringify(schema);
    return [
      { type: 'put', key: keys.schemaLatest(schema.name), value: str }, 
      { type: 'put', key: keys.schema(schema.name, '000100'), value: str }
    ];
  }

  putMetadata() {
    return [{ type: 'put', key: keys.metadata(), 
      value: JSON.stringify(this.metadata) }];
  }
}

const ddb = new DB(level('/tmp/ddb-test'));
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

ddb.init().then(async () => {
  await ddb.putSchema(schema1);
  await ddb.putSchema(schema2);
  console.log(ddb.schemas);
});


module.exports = DB;

// log
// - load log
// - put log
// - get log
// metadata
// - init metadata
// - put metadata
// - get metadata
// schema
// - load schemas
//
// serve



/*
Promise.all([
  db.invertedIndex('entity:1', 'entity', `
    And the earth was without form, and void; and darkness was upon the face of the deep. 
    And the Spirit of God moved upon the face of the waters.`),
  db.invertedIndex('entity:2', 'entity', `
    And the earth was without form, and void; and darkness was upon the face of the deep. 
    And the Spirit of God moved upon the face of the waters. Jesus`),
  db.invertedIndex('entity:3', 'entity', 'nasty'),
  db.invertedIndex('entity:4', 'entity', 'bad man'),
  db.put('entity:4', '{ doc4 }'),
  db.put('entity:3', '{ doc3 }'),
  db.put('entity:2', '{ doc2 }'),
  db.put('entity:1', '{ doc1 }'),
]).then(async () => 
  console.log(await db.search('god void', 'entity')))
*/

/*

model.mapReduce('myMappedIndex', function (e, emit) {
  emit('index.count', e);
}, function (p, doc, emit) {
  emit('index:count', p + doc.someNum);
});
*/
/*
const tid = db.getTid();
const ts = db.getTidTimestamp(tid);
const id = db.getTidCount(tid);
console.log(Number(id));
console.log(new Date(Number(ts)));

db.batch()
  .put('#doc:1/15518843922520000000000000001', JSON.stringify({
      _rts: +new Date(),
      _wts: +new Date()
   }))
  .put('#doc:1/15518843922520000000000000002', JSON.stringify({
      _rts: +new Date(),
      _wts: +new Date()
   }))
  .put('#doc:1/15518843922520000000000000003', JSON.stringify({
      _rts: +new Date(),
      _wts: +new Date()
   }))
  .write()
  .then(() => {
    const t1 = db.transaction((t) => {
      console.log(t.tid);   
      t.get('#doc1')
        .then((data) => {
          t.put('#doc:1', 'doc1')
            .put('#doc:1', 'doc1')
            .put('#doc:1', 'doc1')
            .put('#doc:1', 'doc1')
        });
    });
  });
*/
/*
(async () => await db.ttlReplay())();

Promise.all([
  db.ttlPut('ttl1', 10000),
  db.ttlPut('ttl2', 10000),
  db.ttlPut('ttl3', 10000),
]).then(process.exit);
*/
/*
db.batch()
  .put('key:1', 'value:1')
  .put('key:2', 'value:2')
  .put('key:3', 'value:3')
  .put('key:4', 'value:4')
  .put('key:5', 'value:5')
  .put('key:6', 'value:6')
  .put('key:7', 'value:7')
  .put('key:8', 'value:8')
  .write()
  .then(async () => {
    let fn = (k, v, emit) => { 
      return Promise.resolve(emit(k, v));
    };
    await db.putView('2', 'key:2', 'key:~', fn);
    await db.delView('2');
  });
/*
db.loadViews()
  .then(() => db.trigger('key:1', 'value:1'))
  .then(() => {
    console.log(db.views);
    console.log(db.views[0].fn.toString());
    db.views[0].fn();
  });
Promise.all([
  db.putView('1', 'key:1', 'key:~', (k, v, emit) => console.log(999)),
  db.putView('2', 'key:2', 'key:~', (k, v, emit) => emit(k, v)),
  db.putView('3', 'key:3', 'key:~', (k, v, emit) => emit(k, v)),
  db.putView('4', 'key:4', 'key:~', (k, v, emit) => emit(k, v)),
])
.then(() => console.log(db.views))
.then(() => db.views[0].fn());
*/
