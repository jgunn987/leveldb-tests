const _ = require('lodash');
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
    testInverted: { type: 'inverted', fields: ['testInverted'] }
  }
};

const TestSchema4 = {
  name: 'Test',
  indexes: {
    testDefault: { type: 'default', fields: ['testDefault'] },
    testUnique: { type: 'default', fields: ['testUnique'], unique: true },
    testInverted: { type: 'inverted', fields: ['testInverted'] },
    testSubIndex: { type: 'link', rel: 'HAS_A', table: 'Test', indexes: {
      testDefault: { type: 'default', fields: ['testDefault'] },
      testInverted: { type: 'inverted', fields: ['testInverted'] },
      testSubIndex: { type: 'link', rel: 'IS_A', table: 'Test', indexes: {
        testDefault: { type: 'default', fields: ['testDefault'] },
      }}
    }}
  }
};

const testDocument1 = {
  testDefault: 'testDefaultValue',
  testUnique: 'testUniqueValue1',
  testInverted: 'testInvertedValue on off',
  extra: {
    level1: [1, 2, 3],
    level2: {
      value: 'string'
    }
  }
};

const testDocument2 = {
  testDefault: 'testDefaultValue',
  testUnique: 'testUniqueValue2',
  testInverted: 'testInvertedValue on off',
  extra: {
    level1: [1, 2, 3],
    level2: {
      value: 'string2'
    }
  }
};

const testDocument3 = {
  testDefault: 'testDefaultValue',
  testUnique: 'testUniqueValue3',
  testInverted: 'testInvertedValue on off',
  extra: {
    level1: [1, 3, 3],
    level2: {
      value: 'string3'
    }
  }
};

const testDocument4 = {
  testDefault: 'testDefaultValue',
  testUnique: 'testUniqueValue4',
  testInverted: 'testInvertedValue on off',
  extra: {
    level1: [1, 4, 3],
    level2: {
      value: 'string4'
    }
  }
};

const testDocument5 = {
  testDefault: 'testDefaultValue',
  testUnique: 'testUniqueValue5',
  testInverted: 'testInvertedValue on off',
  extra: {
    level1: [1, 5, 3],
    level2: {
      value: 'string5'
    }
  }
};

const testDocument6 = {
  testDefault: 'testDefaultValue',
  testUnique: 'testUniqueValue6',
  testInverted: 'testInvertedValue on off',
  extra: {
    level1: [1, 6, 3],
    level2: {
      value: 'string6'
    }
  },
  $links: {
    put: [
      ['owns', 'Car:1']
    ],
    del: []
  }
};

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
  id1 = await db.put('Test', testDocument1);
  id2 = await db.put('Test', testDocument2);
  id3 = await db.put('Test', testDocument3);
  id4 = await db.put('Test', testDocument4);
  id5 = await db.put('Test', testDocument5);
  id6 = await db.put('Test', testDocument6);
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
  assert.ok(doc1.testDefault === testDocument1.testDefault);
  assert.ok(doc1.testUnique === testDocument1.testUnique);
  assert.ok(doc1.testInverted === testDocument1.testInverted);
  const doc2 = await db.get('Test', id2);
  assert.ok(doc2._id);
  assert.ok(doc2.testDefault === testDocument2.testDefault);
  assert.ok(doc2.testUnique === testDocument2.testUnique);
  assert.ok(doc2.testInverted === testDocument2.testInverted);
  const doc3 = await db.get('Test', id3);
  assert.ok(doc3._id);
  assert.ok(doc3.testDefault === testDocument3.testDefault);
  assert.ok(doc3.testUnique === testDocument3.testUnique);
  assert.ok(doc3.testInverted === testDocument3.testInverted);
  const doc4 = await db.get('Test', id4);
  assert.ok(doc4._id);
  assert.ok(doc4.testDefault === testDocument4.testDefault);
  assert.ok(doc4.testUnique === testDocument4.testUnique);
  assert.ok(doc4.testInverted === testDocument4.testInverted);
  const doc5 = await db.get('Test', id5);
  assert.ok(doc5._id);
  assert.ok(doc5.testDefault === testDocument5.testDefault);
  assert.ok(doc5.testUnique === testDocument5.testUnique);
  assert.ok(doc5.testInverted === testDocument5.testInverted);
  const doc6 = await db.get('Test', id6);
  assert.ok(doc6._id);
  assert.ok(doc6.testDefault === testDocument6.testDefault);
  assert.ok(doc6.testUnique === testDocument6.testUnique);
  assert.ok(doc6.testInverted === testDocument6.testInverted);
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

const queryAnd = {
  table: 'Test',
  filter: {
    type: 'and',
    expressions: [{
      type: 'eq',
      field: 'name',
      value: 'James'
    }, {
      type: 'eq',
      field: 'age',
      value: 21
    }]
  }
};

const queryEq = {
  table: 'Test',
  filter: {
    type: 'eq',
    field: 'testDefault',
    value: 'testDefaultValue'
  }
};

const queryOr = {
  table: 'Test',
  filter: {
    type: 'or',
    expressions: [{
      type: 'eq',
      field: 'testDefault',
      value: 'testDefaultValue'
    }, {
      type: 'eq',
      field: 'age',
      value: 21
    }]
  }
};

async function testQuery() {
  const orInMem = await db.query(queryOr); 
  const eqIndex = await db.query(queryEq); 
}

async function testDropMigrate() {
  await db.migrate(TestSchemaNull);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);
}
