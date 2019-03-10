function dropIndex(db, table, index) {
  return db.createReadStream({ 
    gte: '%' + table + '/$i/' + index,
    lt: '%' + table + '/$i/' + index + '~',
    values: false,
    keys: true
  }).on('close', () => {})
    .on('end', () => {})
    .on('data', (key) => db.del(key));
}

function createIndex(db, schema, index) {
  return db.createReadStream({ 
    gte: '%' + table + '/$latest',
    lt: '%' + table + '/$latest~',
    values: true,
    keys: true
  }).on('close', () => {})
    .on('end', () => {})
    .on('data', (data) => {
      //get indexer
      //run indexer directly
    });
}

function indexDocument(db, schema, p, c) {
  Object.keys(schema.indexes).map((index) => {
    //get indexer
    //run indexer directly
  });
}

function index(db, schema, index, p, c) {
  if(!p[field] && c[field]) {
    return [['put', c[field]]];
  } else if(p[field] && !c[field]) {
    return [['del', p[field]]];
  } else if (p[field] !== c[field]) {
    return [['del', p[field]],
            ['put', c[field]]];
  } else {
    return [];
  }
}

class IndexManager {
  constructor(db, schemas) {
    this.db = db;
    this.schemas = schemas;
    this.indexers = {};
  }

  addIndexer(type, fn) {
    this.indexers[type] = fn;
    return this;
  }

  createIndex() {}
  indexDocument(doc) {}
  dropIndex() {}
}

const level = require('level');
const db = level('/tmp/index-db');
const indexer = new IndexManager(db, 'Entity', {});
indexer.addIndexer('default', index)
  .addIndexer('compound', index)
  .addIndexer('unique', index)
  .addIndexer('inverted', index);

