const _ = require('lodash');
const level = require('level');
const assert = require('assert');
const dbm = require('../.');
const db = dbm(level('/tmp/test-db'));

const {
  TestSchemaNull,
  TestSchema1,
  TestSchema2,
  TestSchema3,
  TestSchema4
} = require('./data/schema');

const {
  TestDocument1,
  TestDocument2,
  TestDocument3,
  TestDocument4,
  TestDocument5,
  TestDocument6
} = require('./data/document');

const {
  queryAnd,
  queryOr,
  queryEq
} = require('./data/query');

db.once('init', runAll);

async function runAll() {
  await testInit();
  await testCreateMigrate();
  await testPut();
  await testGet();
  await testQuery();
  await testDel();
  await testDropMigrate();
  db.db.createKeyStream()
    .on('data', console.log);
}

async function testInit() {
  await db.init();
  assert.ok(db.metadata);
  assert.ok(db.metadata.tables.length === 0);
}

async function testCreateMigrate() {
  await db.migrate(TestSchema1);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);
  await db.migrate(TestSchema2);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);
  await db.migrate(TestSchema3);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);
  await db.migrate(TestSchema4);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);
}

let id1, id2, id3, id4, id5, id6;

async function testPut() {
  id1 = await db.put('Test', TestDocument1);
  id2 = await db.put('Test', TestDocument2);
  id3 = await db.put('Test', TestDocument3);
  id4 = await db.put('Test', TestDocument4);
  id5 = await db.put('Test', TestDocument5);
  id6 = await db.put('Test', TestDocument6);
  assert.ok(id1);
  assert.ok(id2);
  assert.ok(id3);
  assert.ok(id4);
  assert.ok(id5);
  assert.ok(id6);
}

async function testGet() {
  const doc1 = await db.get('Test', id1);
  assert.ok(doc1._id);
  assert.ok(doc1.testDefault === TestDocument1.testDefault);
  assert.ok(doc1.testUnique === TestDocument1.testUnique);
  assert.ok(doc1.testInverted === TestDocument1.testInverted);
  const doc2 = await db.get('Test', id2);
  assert.ok(doc2._id);
  assert.ok(doc2.testDefault === TestDocument2.testDefault);
  assert.ok(doc2.testUnique === TestDocument2.testUnique);
  assert.ok(doc2.testInverted === TestDocument2.testInverted);
  const doc3 = await db.get('Test', id3);
  assert.ok(doc3._id);
  assert.ok(doc3.testDefault === TestDocument3.testDefault);
  assert.ok(doc3.testUnique === TestDocument3.testUnique);
  assert.ok(doc3.testInverted === TestDocument3.testInverted);
  const doc4 = await db.get('Test', id4);
  assert.ok(doc4._id);
  assert.ok(doc4.testDefault === TestDocument4.testDefault);
  assert.ok(doc4.testUnique === TestDocument4.testUnique);
  assert.ok(doc4.testInverted === TestDocument4.testInverted);
  const doc5 = await db.get('Test', id5);
  assert.ok(doc5._id);
  assert.ok(doc5.testDefault === TestDocument5.testDefault);
  assert.ok(doc5.testUnique === TestDocument5.testUnique);
  assert.ok(doc5.testInverted === TestDocument5.testInverted);
  const doc6 = await db.get('Test', id6);
  assert.ok(doc6._id);
  assert.ok(doc6.testDefault === TestDocument6.testDefault);
  assert.ok(doc6.testUnique === TestDocument6.testUnique);
  assert.ok(doc6.testInverted === TestDocument6.testInverted);
}

async function testGetAfterDelete(table, id) {
  try {
    console.log(await db.get(table, id));
  } catch(err) {
    return assert.ok(err);
  }
  return assert.fail();
}

async function testDel() {
  await db.del('Test', id1);
  await db.del('Test', id2);
  await db.del('Test', id3);
  await db.del('Test', id4);
  await db.del('Test', id5);
  await db.del('Test', id6);
  testGetAfterDelete('Test', id1);
  testGetAfterDelete('Test', id2);
  testGetAfterDelete('Test', id3);
  testGetAfterDelete('Test', id4);
  testGetAfterDelete('Test', id5);
  testGetAfterDelete('Test', id6);
}

async function testQuery() {
  const orInMem = await db.query(queryOr); 
  const eqIndex = await db.query(queryEq); 
}

async function testDropMigrate() {
  await db.migrate(TestSchemaNull);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);
}
