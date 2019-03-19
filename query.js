const _ = require('lodash');
const jmespath = require('jmespath');

const schema = {
  name: 'TestQuery',
  indexes: {
    name: { type: 'default', fields: ['name'] } 
  }
};

function docEq(db, doc, field, value) {
  return Promise.resolve(jmespath.search(doc, field) === value);
}

function indexEq(db, index, value) {
  const key = index + ':' + value;
  return db.createReadStream({ gte: key + ':', lte: key + '~' });
}

// we need to hold a central set of all results
// run every index in parallel and aggregate the results
// as a set union. 
function or(schema, f) {
  // if there is one expression in the chain that doesn't have
  // an index then we need to run a full scan, which means we dont run
  // any index scans we run all through memory
  const parsed = f.expressions.map(e => parseFilter(schema, e));
  return [makeInMemOrClosure(parsed)];

  /*
  const inmem = parsed.filter(e => e[0]).map(e => e[0]);
  const index = parsed.filter(e => e[1]).map(e => e[1]);
  return index.length === parsed.length ?
    [inmem, index] : [inmem];
  */
}

function makeInMemOrClosure(parsedExpressions) {
  return async function (db, doc) {
    const length = parsedExpressions.length;
    for(let i=0; i < length; ++i)
      if(await parsedExpressions[i][0](db, doc))
        return true;
    return false;
  };
}

function and(schema, f) {
  // we can get away without a full scan if we have at least one index
  // as our resulting set will have to be in that index.
  // once scanned, we individually fetch the documents
  // for all in that index and run through the in memory evaluators
  const parsed = f.expressions.map(e => parseFilter(schema, e));
  return [makeInMemAndClosure(parsed)];
  /*
  const inmem = parsed.filter(e => e[0]).map(e => e[0]);
  const compound = findCompoundIndex(schema, f.expressions);
  if(compound) {
    return [inmem, (db, ...values) => 
      indexEq(db, compound, ...values)];
  }

  const index = parsed.find(e => e[1]);
  // run the first index we find, combining with inmem evaluators
  return index ?
    [inmem, (db, ...values) => index[1](db, value)] : [inmem];
  */
}

function makeInMemAndClosure(parsedExpressions) {
  return async function (db, doc) {
    const length = parsedExpressions.length;
    for(let i=0; i < length; ++i)
      if(!await parsedExpressions[i][0](db, doc))
        return false;
    return true;
  };
}

function eq(schema, f) {
  const indexes = findIndexes(schema, f.field); 
  return indexes.length ? [
    makeInMemClosure(docEq, f.field, f.value), 
    makeIndexClosure(indexEq, indexes[0])
  ] : [makeInMemClosure(docEq, f.field, f.value)];
}

function makeInMemClosure(fn, field, ...values) {
  return (db, doc) => fn(db, doc, field, ...values);
}

function makeIndexClosure(fn, index, ...values) {
  return (db) => fn(db, index, ...values);
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

const queryAnd = parseFilter(schema, {
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

const queryOr = parseFilter(schema, {
  type: 'or',
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

Promise.all([
  queryOr[0]({}, { age: 21, name: 'James' }),
  queryOr[0]({}, { age: 22, name: 'James' }),
  queryOr[0]({}, { age: 22, name: 'ames' })
]).then(console.log);

Promise.all([
  queryAnd[0]({}, { age: 21, name: 'James' }),
  queryAnd[0]({}, { age: 22, name: 'James' }),
  queryAnd[0]({}, { age: 22, name: 'ames' })
]).then(console.log);
