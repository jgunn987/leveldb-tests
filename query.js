// *if the query is on a primary key scan the whole db
// *if within and AND chain, if one or more filters has an index
//  start with these indexes, then fetch the matched documents and
//  run all the other filters that dont have an index against matched documents
// *if there are no indexes run all against a full scan
// *all OR chains must be run against a full scan of the parent
const level = require('level');
const db = level('/tmp/query-db');
const mergeStream = require('merge-stream'); 
const keys = require('./keys');
const jmespath = require('jmespath');

function docEq(db, doc, field, value) {
  return Promise.resolve(doc[field] === value);
}

function indexEq(db, index, value) {
  return db.createReadStream({
    gte: index + ':' + value,
    lte: index + ':' + value + '~'
  });
}

function docNeq(db, doc, field, value) {
  return Promise.resolve(doc[field] !== value);
}

function indexNeq(db, index, value) {
  return mergeStream(db.createReadStream({
    gt: index + ':',
    lt: index + ':' + value
  }), db.createReadStream({
    gt: index + ':' + value,
    lt: index + ':~'
  }));
}

function docGt(db, doc, field, value) {
  return Promise.resolve(doc[field] > value);
}

function indexGt(db, index, value) {
  return db.createReadStream({ gt: index + ':' + value });
}

function docGte(db, doc, field, value) {
  return Promise.resolve(doc[field] >= value);
}

function indexGte(db, index, value) {
  return db.createReadStream({ gte: index + ':' + value });
}

function docLt(db, doc, field, value) {
  return Promise.resolve(doc[field] < value);
}

function indexLt(db, index, value) {
  return db.createReadStream({ lt: index + ':' + value });
}

function docLte(db, doc, field, value) {
  return Promise.resolve(doc[field] <= value);
}

function indexLte(db, index, value) {
  return db.createReadStream({ lte: index + ':' + value });
}
// value must be a RegExp object
function docMatch(db, doc, field, value) {
  return Promise.resolve(value.test(doc[field]));
}

function docSearch(db, doc, field, value) {
  // do a search on terms within the document field/s
}

// add a match all or match any option
function indexSearch(db, index, values) {
  return mergeStream(...values.split(' ').map((token) =>
    db.createReadStream({
      gte: index + ':' + token,
      lte: index + ':' + token + '~'
    })));
}

function docWithin(db, doc, field, start, end) {
  const field = doc[field];
  return Promise.resolve(field >= start && field <= end);
}

function indexWithin(db, index, start, end) {
  return db.createReadStream({
    gte: index + ':' + start,
    lte: index + ':' + end
  });
}

function docWithout(db, doc, field, start, end) {
  const field = doc[field];
  return Promise.resolve(field < start || field > end);
}

function indexWithout(db, index, start, end) {
  return mergeStream(db.createReadStream({
    gt: index + ':',
    lt: index + ':' + start
  }), db.createReadStream({
    gt: index + ':' + end,
    lt: index + ':~'
  }));
}

function testOrQuery() {
  return query('Entity')
    .filter((q) => 
      q.union([ //OR
        q.eq('name', 'james'),
        q.eq('name', 'jame'),
        q.eq('name', 'jam'),
        q.eq('name', 'ja'),
        q.eq('name', 'j'),
        q.gt('age', 25), 
        q.within('loc', '12.3458', '114.4489'),
        q.without('loc', '12.3458', '114.4489'),
        q.match('email', '*@{1}.*'),
        q.intersection([ //AND
          q.eq('name', 'gam'),
          q.eq('name', 'ga'),
          q.eq('name', 'g'),
        ])
      ]))
    .project('comments', 'Comment', (q) =>
        q.filter((q) => 
          q.intersection([
            q.search('text', 'Cool Beans'),
            q.lte('number', 1),
            q.eq('name', 'gam'),
            q.eq('name', 'ga'),
            q.eq('name', 'g'),
          ])
        .order('date', 'asc')
        .limit(100))
    .order('date', 'asc')
    .limit(100);
}

{
  table: 'Entity',
  filter: {
    type: 'intersection',
    expressions: [
      { type: 'eq', field: 'name', value: 'James' }, 
      { type: 'gt', field: 'name', value: 'James' }, 
      { type: 'lt', field: 'name', value: 'James' }, 
      { type: 'match', field: 'name', value: '.*' },
      { type: 'union', expressions: [{
        { type: 'eq', field: 'name', value: 'James' }, 
        { type: 'gt', field: 'name', value: 'James' }, 
        { type: 'lt', field: 'name', value: 'James' }, 
        { type: 'match', field: 'name', value: '.*' },
      }] },
    ]
  }],
  projections: [{
    field: 'comments',
    query: {
      table: 'Comment',
      filter: [],
      projections: [{
        field: 'authors',
        table: 'User',
        filter: []
      }]
    }
  }]
  distinct: ['name', 'age'],
  order: { fields: ['name', 'age'], dir: 'ASC' },
  offset: 0,
  limit: 100
}

/*

// range queries e.g. BETWEEN
function testJoinQuery() {
  return query('Entity')
    .where((q) => 
      q.and([
        q.eq('name', 'james'),
        q.eq('name', 'jame'),
        q.eq('name', 'jam'),
        q.eq('name', 'ja'),
        q.eq('name', 'j'),
        q.gt('age', 25) 
        q.between('loc', '12.3458', '114.4489')
      ]))
    .project('comments', (q) =>
      q.where((q) => 
        q.ed('author', 'james'))
      .distinct()
      .order('author', 'desc')
      .offset(10)
      .limit(100))
    .distinct()
    .order('name', 'desc')
    .offset(10)
    .limit(100);

}
function testAndQuery() {
  return query('Entity')
    .where((q) => 
      q.and([
        q.eq('name', 'james'),
        q.eq('name', 'jame'),
        q.eq('name', 'jam'),
        q.eq('name', 'ja'),
        q.eq('name', 'j'),
        q.gt('age', 25) 
      ]))
    .distinct()
    .order('name', 'desc')
    .offset(10)
    .limit(100);
}

function testOrQuery() {
  return query('Entity')
    .where((q) => 
      q.or([
        q.eq('name', 'james'),
        q.eq('name', 'jame'),
        q.eq('name', 'jam'),
        q.eq('name', 'ja'),
        q.eq('name', 'j'),
        q.gt('age', 25) 
      ]))
    .distinct()
    .order('name', 'desc')
    .offset(10)
    .limit(100);
}

const query1 = {
  table: 'Entity',
  count: true,
  where: {
    or: [
      { contains: ['search', 'some phrase'] }
    ],
    and: [
      { eq: ['timestamp', 'NOW'] }, // scan from gte 'timestamp=now' and lte 'timestamp=now'
      { neq: ['name', 'James'] }, // scan from gt 'name=' and lt 'name=James', scan from gt 'name=James' and lt 'name=~'
      { gte: ['gte', '23'] }, // scan from gte 'gte=23' 
      { gt: ['gt', '24'] }, // scan from gt 'gt=24'
      { lte: ['lte', '23'] }, // scan from lte 'lte=23'
      { lt: ['lt', '23'] }, // scan from lt 'lt=23'
      { in: ['array', [1, 2, 3]] }, //scan gte 'array=1' and lte 'array=1',
                                    //scan gte 'array=2' and lte 'array=2',
                                    //scan gte 'array=3' and lte 'array=3',
      { nin: ['array', [1, 2, 3]] }, 
      { match: ['regexp', '.*'] } //scan all where 'regexp=.*'
    ]
  },
  distinct: true,
  order: ['age', 'asc'],
  offset: 10,
  limit: 10
};
*/
