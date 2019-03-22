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

module.exports = {
  queryAnd,
  queryOr,
  queryEq
};
