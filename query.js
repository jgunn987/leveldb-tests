const _ = require('lodash');

const schema = {
  name: 'TestQuery',
  indexes: {
    name: { type: 'default', fields: ['name'] } 
  }
};

function docEq(doc, field, value) { return doc[field] === value; }
function indexEq(index, value) { return value + ':id'; }

function and(schema, f) {
  // TODO: check for compound index availability
  // we can get away without a full scan if we have at least one index
  // as our result set will be in that index.
  // once scanned, we individually fetch the documents
  // for all in that index and run through the in memory evaluators
  const parsed = f.expressions.map(e => parseFilter(schema, e));
  // create a closure for each scan
  const index = parsed.filter(e => e.indexes)
    .map(e => () => {
      indexEq(e.value, e.indexes[0])
    });

  // create a closure for each step
  const inmem = parsed.filter(e => !e.indexes)
    .map(e => (doc) => docEq(doc, e.field, e.value));

  console.log(_.intersection([1,2,3], [2], [2,3])); 
  console.log(inmem[0]({ age: 21 }));
  return parsed;
}

function or(schema, f) {
  // we need to hold a central set of all results
  // run every index in parallel and aggregate the results
  // as a set union. 
  // if there is one expression in the chain that doesn't have
  // an index then we need to run a full scan, which means we dont run
  // any index scans we run all through memory
  const parsed = f.expressions.map(e => parseFilter(schema, e));
  // create a closure for each scan
  const index = parsed.filter(e => e.indexes)
    .map(e => () => {
      indexEq(e.value, e.indexes[0])
    });

  // create a closure for each step
  const inmem = parsed.filter(e => !e.indexes)
    .map(e => (doc) => docEq(doc, e.field, e.value));
}

// each filter returns an optional index based stream
// and an in memory lambda. If no stream is present
// then a full scan of the table will be chosen and
// all filters will run thier in memory lambdas
function parseFilter(schema, f) {
  switch(f.type) {
    case 'or':
      return or(schema, f);
    case 'and':
      return and(schema, f);
    default:
      const indexes = findIndexes(schema, f.field); 
      return indexes.length ? { ...f, indexes } : f;
      break;
  }
}

function findIndexes(schema, field) {
  return Object.keys(schema.indexes)
    .filter(name => {
      const fields = schema.indexes[name].fields || [];
      return fields.indexOf(field) !== -1;
    });
}

parseFilter(schema, {
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
});

