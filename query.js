// *if within and AND chain, if one or more filters has an index
//  start with these indexes, then fetch the matched documents and
//  run all the other filters that dont have an index against matched documents
// *if there are no indexes run all against a full scan
// *all OR chains must be run against a full scan of the parent
const level = require('level');
const db = level('/tmp/query-db');
const mergeStream = require('merge-stream'); 

// set intersection
function queryDocumentAnd(db, doc, filters) {
}

// set union
function queryDocumentOr(db, doc, filters) {

}

function queryDocumentEq(db, doc, field, value) {
  return Promise.resolve(doc[field] === value);
}

function queryIndexEq(db, index, value) {
  return db.createReadStream({
    gte: index + ':' + value,
    lte: index + ':' + value + '~'
  });
}

function queryDocumentNeq(db, doc, field, value) {
  return Promise.resolve(doc[field] !== value);
}

function queryIndexNeq(db, index, value) {
  return mergeStream(db.createReadStream({
    gt: index + ':',
    lt: index + ':' + value
  }), db.createReadStream({
    gt: index + ':' + value,
    lt: index + ':~'
  }));
}

function queryDocumentGt(db, doc, field, value) {
  return Promise.resolve(doc[field] > value);
}

function queryIndexGt(db, index, value) {
  return db.createReadStream({ gt: index + ':' + value });
}

function queryDocumentGte(db, doc, field, value) {
  return Promise.resolve(doc[field] >= value);
}

function queryIndexGte(db, index, value) {
  return db.createReadStream({ gte: index + ':' + value });
}

function queryDocumentLt(db, doc, field, value) {
  return Promise.resolve(doc[field] < value);
}

function queryIndexLt(db, index, value) {
  return db.createReadStream({ lt: index + ':' + value });
}

function queryDocumentLte(db, doc, field, value) {
  return Promise.resolve(doc[field] <= value);
}

function queryIndexLte(db, index, value) {
  return db.createReadStream({ lte: index + ':' + value });
}

// value must be a RegExp object
function queryDocumentMatch(db, doc, field, value) {
  return Promise.resolve(value.test(doc[field]));
}

function queryDocumentSearch(db, doc, field, value) {
  // do a search on terms within the document field/s
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
        q.between('loc', '12.3458', '114.4489'),
        q.match('email', '*@{1}.*'),
        q.intersection([ //AND
          q.eq('name', 'gam'),
          q.eq('name', 'ga'),
          q.eq('name', 'g'),
        ])
      ]))
    .project('comments', (q) =>
        q('Comment')
        .filter((q) => q.search('text', 'Cool Beans'))
        .order('date', 'asc')
        .limit(100))
    .order('date', 'asc')
    .limit(100);
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
