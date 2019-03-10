const { diff } = require('deep-diff');
const _ = require('lodash');

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
    comments: { type: 'Comment' }
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
    one: { type: 'unique', field: 'owner', cascade: 'delete' },
    many: { type: 'default', field: 'comments', cascade: 'delete' }
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
