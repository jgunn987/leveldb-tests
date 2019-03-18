const level = require('level');
const assert = require('assert');
const dbm = require('.');
const db = dbm(level('/tmp/test-db'));

const TestSchemaNull = {
  name: 'Test',
  indexes: {}
};

const TestSchema1 = {
  name: 'Test',
  indexes: {
    testDefault: { type: 'default', fields: ['testDefault'] }
  }
};
const TestSchema2 = {
  name: 'Test',
  indexes: {
    testDefault: { type: 'default', fields: ['testDefault'] },
    testUnique: { type: 'default', fields: ['testUnique'], unique: true }
  }
};

const TestSchema3 = {
  name: 'Test',
  indexes: {
    testDefault: { type: 'default', fields: ['testDefault'] },
    testUnique: { type: 'default', fields: ['testUnique'], unique: true },
    testInverted: { tyep: 'inverted', fields: ['testInverted'] }
  }
};

const testDocument1 = {
  testDefault: 'testDefaultValue',
  testUnique: 'testUniqueValue',
  testInverted: 'testInvertedValue on off'
};

db.once('init', runAll);

async function runAll() {
  await testInit();
  await testInitialMigrate();
  db.db.createKeyStream()
    .on('data', console.log);
}

async function testInit() {
  await db.init();
  assert.ok(db.metadata);
  assert.ok(db.metadata.tables.length === 0);
}

async function testInitialMigrate() {
  await db.migrate(TestSchema1);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);
  await db.migrate(TestSchema2);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);
  await db.migrate(TestSchemaNull);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);
}

async function testPut() {

}
