const _ = require('lodash');
const { Transform } = require('stream');
const db = require('level')('/tmp/streamdb');
const { diff } = require('./schema');
const mergeStream = require('merge-stream');

const schema1 = {
  name: 'Post',
  indexes: {
    title: { type: 'default', fields: ['title'] },
    createdAt: { type: 'default', fields: ['createdAt'] },
    text: { type: 'inverted', fields: ['text'] }
  }
};

const schema2 = {
  name: 'Post',
  indexes: {
    title: { type: 'default', fields: ['a.title'] },
    text: { type: 'inverted', fields: ['text'] },
    author: { type: 'default', fields: ['author'] }
  }
};

function indexKeyStream(db, schema, index) {
  return db.createKeyStream({ 
    gte: keys.indexBase(schema.name, index),
    lt: keys.indexBase(schema.name, index) + '~'
  });
}

function dropIndexStream(db, schema, index) {
  return indexKeyStream(db, schema, index)
    .pipe(new Transform({
      transform: (key, encoding, done) => 
        done({ type: 'del', key })
      }));
}

function createTableStream(db, schema) {
  return db.createReadStream({ 
    gte: keys.docLatestBase(schema.name),
    lt: keys.docLatestBase(schema.name) + '~',
  });
}

function createIndexesStream(db, schema, indexes) {
  return createTableStream(db, schema)
    .pipe(new Transform({
      objectMode: true,
      transform: async (data, encoding, done) => {
        const doc = JSON.parse(data.value);
        indexes.map((index) =>
          invokeIndexer(db, schema, index, doc))
          .map(_.flattenDeep)
          .filter(Boolean)
          .forEach((result) => 
            this.push(result));
        done();
      }
    }));
}

function invokeIndexer(db, schema, index, doc) {
  const options = schema.indexes[name];
  const indexer = db.indexers[options.type];
  if(!indexer) throw new Error('Unknown index type');
  return indexer(db, schema, name, options, doc);
}

function createMigrationStream(db, schema) {
  if(!(name in db.schemas)) {}
  const current = db.schemas[name];
  const diffs = diff(current, schema);
  const stream = mergeStream();
  const create = [];
  diffs.forEach((op) =>
    op.type === 'create' ? 
      create.push(op.index):
      stream.add(dropIndexStream(db, current, index)));
  stream.add(createIndexesStream(db, schema, create));
  return stream;
}

const { Writable, Readable, Duplex } = require('stream');

const rs1 = new Readable({
  objectMode: true,
  read(size) {
    setTimeout(() =>
      this.push((+new Date()).toString() + '----1'), 
        Math.floor(Math.random() * 
          (300 - 150 + 1)) + 150);
  }
});
const rs2 = new Readable({
  objectMode: true,
  read(size) {
    setTimeout(() =>
      this.push((+new Date()).toString() + '----2'), 
        Math.floor(Math.random() * 
          (300 - 150 + 1)) + 150);
  }
});
const rs3 = new Readable({
  objectMode: true,
  read(size) {
    setTimeout(() =>
      this.push(), 
        Math.floor(Math.random() * 
          (300 - 150 + 1)) + 150);
  }
});
const rs4 = new Readable({
  objectMode: true,
  read(size) {
    setTimeout(() =>
      this.push(), 
        Math.floor(Math.random() * 
          (300 - 150 + 1)) + 150);
  }
});

const ts = new Transform({
  objectMode: true,
  transform(key, encoding, done) { 
    return done(null, key);
  }
});

ts.write({ type: 'del', key: 'key1' })
ts.on('data', console.log);

/*
const ms = mergeStream();
ms.add(rs1);
ms.add(rs2);
ms.add(rs3);
ms.add(rs4);
ms.pipe(ts)
  .on('data', console.log);
*/
