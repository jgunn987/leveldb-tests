const { diff } = require('deep-diff');
const _ = require('lodash');
/*
const repository = new Repository()
repository.declare(User);
repository.declare(Post);
repository.declare(Comment);

repository.declareQuery('postsInThePast', q =>
  query.select('*').from('Post')
    .where('date < NOW()'));

repository.search('Post', post => {
  post.comments().search('where contains i am', comment => {
    console.log(comment.getText());
    comment.getAuthor(author =>
      console.log(author.getName()));
  })
});
*/

function testQuery() {
  return query('Entity')
    .where((q) => {
      return q.or([
        q.eq('name', 'james'),
        q.eq('name', 'jame'),
        q.eq('name', 'jam'),
        q.eq('name', 'ja'),
        q.eq('name', 'j'),
        q.gt('age', 25)
      ]);
    }).distinct()
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

function extendSchema(c, schema) {
  return c ? extendSchema(
    Object.getPrototypeOf(c), 
    _.merge({}, c.schema, schema)
  ) : schema;
}

function diffSchema(previous, current) {
  return diff(previous, current).map(d => {
    switch (d.kind) {
      case 'N':
        console.log(d.rhs);
        break;
      case 'D':
        console.log(d.rhs);
        break;
      case 'E':
        console.log(d.rhs);
        break;
      case 'A':
        console.log(d.rhs);
        break;
    }
  });
}

class Entity {
  static getSchema() {
    return extendSchema(this, Entity.schema);
  }
}
Entity.schema = {
  fields: {},
  indexes: {}
};

class User extends Entity {}
User.schema = {
  fields: {
    user: { type: true }
  }
  // unique indexes
  // regular indexes
  // compound indexes
  // inverted indexes
  // hasOne
  // hadMany
  // embedded schemas
  // materialized paths
  // manyToMany
  // table name
  // cascade delete
  // allow disallow extra unindexed fields, JSON
  retainUndeclared: false,
  indexes: {
    name: { type: 'default', field: 'name' },
    geloc: { type: 'compound', fields: ['long', 'lat'] },
    sub: { type: 'default', field: 'address.country' },
    uniq: { type: 'unique', field: 'email' },
    search: { type: 'inverted', fields: ['bio', 'description'] }
    one: { type: 'unique', field: 'owner' },
  }
};

class SuperUser extends User {}
SuperUser.schema = {
  fields: {
    superUser: { type: true }
  }
};

console.log(SuperUser.getSchema());
console.log(diffSchema( 
  { fields: { a: { unique: true }, b: 1 } },
  { fields: { a: { unique: false }, c: 3 } }));
