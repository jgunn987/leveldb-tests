const level = require('level');
const assert = require('assert');
const dbm = require('.');
const db = dbm(level('/tmp/test-db'));

const schema1 = {
  name: 'Test'
};
const schema2 = {
  name: 'Test'
};

db.once('init', runAll);

async function runAll() {
  assert.ok(db.metadata);
  assert.ok(db.metadata.tables.length === 0);

  await db.migrate(schema1);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);
  await db.migrate(schema2);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);

  db.db.createKeyStream()
    .on('data', console.log);


}

