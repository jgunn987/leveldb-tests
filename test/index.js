const _ = require('lodash');
const level = require('level');
const assert = require('assert');
const dbm = require('../.');
const db = dbm(level('/tmp/test-db'));
const schemas = require('./data/schema');
const documents = require('./data/document');
const queries = require('./data/query');

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
  await db.migrate(schemas[1]);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);
  await db.migrate(schemas[2]);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);
  await db.migrate(schemas[3]);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);
  await db.migrate(schemas[4]);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);
}

let id1, id2, id3, id4, id5, id6;

async function testPut() {
  id1 = await db.put('Test', documents[0]);
  id2 = await db.put('Test', documents[1]);
  id3 = await db.put('Test', documents[2]);
  id4 = await db.put('Test', documents[3]);
  id5 = await db.put('Test', documents[4]);
  id6 = await db.put('Test', documents[5]);
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
  assert.ok(doc1.testDefault === documents[0].testDefault);
  assert.ok(doc1.testUnique === documents[0].testUnique);
  assert.ok(doc1.testInverted === documents[0].testInverted);
  const doc2 = await db.get('Test', id2);
  assert.ok(doc2._id);
  assert.ok(doc2.testDefault === documents[1].testDefault);
  assert.ok(doc2.testUnique === documents[1].testUnique);
  assert.ok(doc2.testInverted === documents[1].testInverted);
  const doc3 = await db.get('Test', id3);
  assert.ok(doc3._id);
  assert.ok(doc3.testDefault === documents[2].testDefault);
  assert.ok(doc3.testUnique === documents[2].testUnique);
  assert.ok(doc3.testInverted === documents[2].testInverted);
  const doc4 = await db.get('Test', id4);
  assert.ok(doc4._id);
  assert.ok(doc4.testDefault === documents[3].testDefault);
  assert.ok(doc4.testUnique === documents[3].testUnique);
  assert.ok(doc4.testInverted === documents[3].testInverted);
  const doc5 = await db.get('Test', id5);
  assert.ok(doc5._id);
  assert.ok(doc5.testDefault === documents[4].testDefault);
  assert.ok(doc5.testUnique === documents[4].testUnique);
  assert.ok(doc5.testInverted === documents[4].testInverted);
  const doc6 = await db.get('Test', id6);
  assert.ok(doc6._id);
  assert.ok(doc6.testDefault === documents[5].testDefault);
  assert.ok(doc6.testUnique === documents[5].testUnique);
  assert.ok(doc6.testInverted === documents[5].testInverted);
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
  const eqIndex = await db.query(queries[0]); 
  console.log(eqIndex);
  assert.ok(eqIndex.length === 6);
  assert.ok(typeof eqIndex[0] !== 'string');
  const orInMem = await db.query(queries[2]); 
  assert.ok(eqIndex.length === 6);
  assert.ok(typeof eqIndex[0] !== 'string');
}

async function testDropMigrate() {
  await db.migrate(schemas[0]);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);
}
