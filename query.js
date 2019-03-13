function queryDocumentEq(db, doc, field, value) {
  return Promise.resolve(doc[field] === value);
}

function queryIndexEq(db, index, value) {
  return new Promise((resolve, reject) => {
    const matches = [];
    db.createReadStream({
      gte: index + ':' + value,
      lte: index + ':' + value + '~'
    }).on('error', reject)
      .on('end', () => resolve(matches))
      .on('data', (data) =>
        matches.push(data.value));
    });
}

function queryDocumentNeq(db, doc, field, value) {
  return Promise.resolve(doc[field] !== value);
}

function queryIndexNeq(db, index, value) {
  return new Promise((resolve, reject) => {
    const matches = [];
    let finished = 0;
    db.createReadStream({
      gt: index + ':',
      lt: index + ':' + value
    }).on('error', reject)
      .on('end', () => if(++finished >= 2) resolve(matches))
      .on('data', (data) =>
        matches.push(data.value));
    db.createReadStream({
      gt: index + ':' + value,
      lt: index + ':~'
    }).on('error', reject)
      .on('end', () => if(++finished >= 2) resolve(matches))
      .on('data', (data) =>
        matches.push(data.value)))
    });
}

function queryDocumentGt(db, doc, field, value) {
  return Promise.resolve(doc[field] > value);
}

function queryIndexGt(db, index, value) {
  return new Promise((resolve, reject) => {
    const matches = [];
    db.createReadStream({
      gt: index + ':' + value
    }).on('error', reject)
      .on('end', () => resolve(matches))
      .on('data', (data) =>
        matches.push(data.value));
    });
}

function queryDocumentGte(db, doc, field, value) {
  return Promise.resolve(doc[field] >= value);
}

function queryIndexGte(db, index, value) {
  return new Promise((resolve, reject) => {
    const matches = [];
    db.createReadStream({
      gte: index + ':' + value
    }).on('error', reject)
      .on('end', () => resolve(matches))
      .on('data', (data) =>
        matches.push(data.value));
    });
}

function queryDocumentLt(db, doc, field, value) {
  return Promise.resolve(doc[field] < value);
}

function queryIndexLt(db, index, value) {
  return new Promise((resolve, reject) => {
    const matches = [];
    db.createReadStream({
      lt: index + ':' + value
    }).on('error', reject)
      .on('end', () => resolve(matches))
      .on('data', (data) =>
        matches.push(data.value));
    });
}

function queryDocumentLte(db, doc, field, value) {
  return Promise.resolve(doc[field] <= value);
}

function queryIndexLte(db, index, value) {
  return new Promise((resolve, reject) => {
    const matches = [];
    db.createReadStream({
      lte: index + ':' + value
    }).on('error', reject)
      .on('end', () => resolve(matches))
      .on('data', (data) =>
        matches.push(data.value));
    });
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
        q.between('loc', '12.3458', '114.4489')
      ])));
}

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
