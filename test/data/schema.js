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

module.exports = {
  TestSchemaNull,
  TestSchema1,
  TestSchema2,
  TestSchema3,
  TestSchema4
};
