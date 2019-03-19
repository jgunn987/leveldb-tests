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
  // as our resulting set will have to be in that index.
  // once scanned, we individually fetch the documents
  // for all in that index and run through the in memory evaluators
  const compound = findCompoundIndex(schema, f.expressions);
  const parsed = f.expressions.map(e => parseFilter(schema, e));
  // create a closure for each scan
  const index = parsed.filter(e => e.indexes)
    .map(e => () => {
      indexEq(e.value, e.indexes[0])
    });

  // create a closure for each step
  const inmem = parsed.filter(e => !e.indexes)
    .map(e => (doc) => docEq(doc, e.field, e.value));

  //console.log(_.intersection([1,2,3], [2], [2,3])); 
  //console.log(inmem[0]({ age: 21 }));
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

function findCompoundIndex(schema, filters, type = 'default') {
  const names = filters.map(f => f.field).sort();
  return filters.find(f => f.type === 'eq') ?
    Object.keys(schema.indexes)
      .filter(name => {
        const index = schema.indexes[name];
        return index.type === type &&
          _.isEqual(names, (index.fields || []).sort())
      })[0] : undefined;
}

function findIndexes(schema, field, type = 'default') {
  return Object.keys(schema.indexes)
    .filter(name => {
      const index = schema.indexes[name];
      const fields = index.fields || [];
      return fields.indexOf(field) !== -1 && 
        index.type === type &&
        fields.length === 1;
    });
}

// * get schema for query
// * parse filters
// * parse projections
// * run main table query
// * sort and limit main query
// * run projection queries 
// * sort and limit projection queries
// * return results;
function parseQuery(q) {
  const schema = {};
  const filter = parseFilter(schema, q);
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

