const _ = require('lodash');
const uuid = require('uuid');
const keys = require('./keys');
const defaults = require('./defaults');
const inverted = require('./inverted');
const Indexer = require('./indexer');
const { diff } = require('./schema');

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
      this.metadata = JSON.parse(await this.db.get(key));
    } catch(err) {
      console.log('Could not find system metadata, initializing new');
      this.metadata = { tables: [] };
      await this.db.put(key, JSON.stringify(this.metadata));
    }
    return this;
  }

  async loadSchemas() {
    return Promise.all(this.metadata.tables.map(
      async (table) => this.loadSchema(table)));
  }

  async loadSchema(name) {
    try {
      return this.schemas[name] = 
        JSON.parse(await this.db.get(
          keys.schemaLatest(name)));
    } catch (err) {
      console.log(`Could not find schema for table "${name}"`);
    }
  }

  async migrate(schema) {
    const name = schema.name;
    const ops = [];

    if(name in this.schemas) {
      console.log(`Performing migration on table '${name}'`);
      ops.push(...await this.migrateSchema(this.schemas[name], schema));
      console.log(`Migration complete on table '${name}'`);
    } else {
      console.log(`Creating new table '${name}'`);
      ops.push(...await this.createNewTable(schema));
      console.log(`Table '${name}' created`);
    }

    this.schemas[schema.name] = schema;
    this.metadata.tables.push(name);
    this.metadata.tables = _.uniq(this.metadata.tables);
    ops.push(...this.putNewSchemaVersion(schema), 
             ...this.putMetadata());
    
    await this.db.batch(ops);
    return this;
  }

  async migrateSchema(p, c) {
    return await Promise.all(diff(p, c).map(async (op) => {
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
    const str = JSON.stringify(schema);
    this.schemas[schema.name] = schema = 
      Object.assign(schema, { _v: +new Date() });

    return [
      { type: 'put', key: keys.schemaLatest(schema.name), value: str }, 
      { type: 'put', key: keys.schema(schema.name, schema._v), value: str }
    ];
  }

  putMetadata() {
    return [{ type: 'put', key: keys.metadata(), 
      value: JSON.stringify(this.metadata) }];
  }

  async putDocument(table, doc) {
    if(this.metadata.tables.indexOf(table) === -1) {
      throw new Error(`Unknown table '${table}'`);
    }

    const schema = this.schemas[table];
    if(!schema) {
      throw new Error(`No schema registered for table '${table}'`);
    }

    if(!doc._id) {
      doc = Object.assign(doc, { _id: uuid.v4() });
    } 

    if(!doc._v) {
      doc = Object.assign(doc, { _v: +new Date() });
    }

    const json = JSON.stringify(doc);
    return this.db.batch([
      ...await this.indexer.index(schema, doc), 
      { type: 'put', key: keys.docLatest(table, doc._id), value: json },
      { type: 'put', key: keys.doc(table, doc._id, doc._v), value: json }
    ]);
  }
  
  getDoc(table, uuid) {
    return this.db.get(keys.docLatest(table, uuid));
  }

  query(query) {
    const table = 'Post';
    const schema = this.schemas[table];
    console.log(this.selectIndex(schema, 'name')) 
  }
  
  selectIndex(schema, field) {
    return Object.keys(schema.indexes)
      .filter((name) => schema.indexes[name]
        .fields.indexOf(field) !== -1)
      .map((name) => schema.indexes[name]);
  }
}

module.exports = (driver) => {
  const db = new DB(driver);
  db.indexer.use('default', defaults.index);
  db.indexer.use('inverted', inverted.index);
  return db;
};
