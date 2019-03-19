const _ = require('lodash');

const schema = {
  name: 'TestQuery',
  indexes: {
    name: { type: 'default', fields: ['name'] } 
  }
};

function docEq(doc, field, value) { return doc[field] === value; }
function indexEq(db, index, value) { 
  console.log('i got called');
  return value + ':id'; 
}

function and(schema, f) {
  // we can get away without a full scan if we have at least one index
  // as our resulting set will have to be in that index.
  // once scanned, we individually fetch the documents
  // for all in that index and run through the in memory evaluators
  const parsed = f.expressions.map(e => parseFilter(schema, e));
  const inmem = parsed.filter(e => e[0]).map(e => e[0]);
  const compound = findCompoundIndex(schema, f.expressions);
  if(compound) {
    return [inmem, (db, ...values) => 
      indexEq(db, compound, ...values)];
  }
  
  const index = parsed.find(e => e[1]);
  // run the first index we find, combining with inmem evaluators
  return index ?
    [inmem, (db, ...values) => 
      index[1](db, value)] : [inmem];
}

// we need to hold a central set of all results
// run every index in parallel and aggregate the results
// as a set union. 
function or(schema, f) {
  const parsed = f.expressions.map(e => parseFilter(schema, e));
  const inmem = parsed.filter(e => e[0]).map(e => e[0]);
  const index = parsed.filter(e => e[1]).map(e => e[1]);
  // if there is one expression in the chain that doesn't have
  // an index then we need to run a full scan, which means we dont run
  // any index scans we run all through memory
  return index.length === parsed.length ?
    [inmem, parsed] : [inmem];
}

function eq(schema, f) {
  const indexes = findIndexes(schema, f.field); 
  return indexes.length ?
    [docEq, (db, value) =>
      indexEq(db, indexes[0], value)] : [docEq];
}

// each filter returns an optional index based stream
// and an in memory lambda. If no stream is present
// then a full scan of the table will be chosen and
// all filters will run thier in memory lambdas
const filters = { and, or, eq };

function parseFilter(schema, f) {
  const filter = filters[f.type];
  return filter ? filter(schema, f) : eq(schema, f);
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

console.log(parseFilter(schema, {
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
}));

