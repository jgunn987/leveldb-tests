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
  await testInitialMigrate();
  await testPut();
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
  await db.migrate(TestSchema3);
  assert.ok(db.schemas['Test']);
  assert.ok(db.metadata.tables.indexOf('Test') !== -1);
  //await db.migrate(TestSchemaNull);
  //assert.ok(db.schemas['Test']);
  //assert.ok(db.metadata.tables.indexOf('Test') !== -1);
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

