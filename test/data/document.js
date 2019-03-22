const TestDocument1 = {
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

const TestDocument2 = {
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

const TestDocument3 = {
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

const TestDocument4 = {
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

const TestDocument5 = {
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

const TestDocument6 = {
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

module.exports = {
  TestDocument1,
  TestDocument2,
  TestDocument3,
  TestDocument4,
  TestDocument5,
  TestDocument6
};
