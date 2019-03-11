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
      { neq: ['name', 'James'] }, // scan from gte 'name=' and lt 'name=James', scan from gt 'name=James' and lt 'name=~'
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
