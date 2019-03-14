// unique indexes
// regular indexes
// compound indexes
// inverted indexes
// hasOne
// hadMany
// manyToMany
// table name
// cascade delete
// inverted index on stringified JSON 
// allow disallow extra unindexed fields, JSON
// range queries e.g. BETWEEN
const schema = {
  name: 'Post',
  extends: 'Entity',
  deleteOrphan: true,
  indexes: {
    name: { type: 'default', fields: ['name'] },
    geloc: { type: 'geo', fields: ['long', 'lat'] },
    compound: { type: 'default', fields: ['a.b', 'c.d.e'] },
    sub: { type: 'default', fields: ['address.country'] },
    uniq: { type: 'default', fields: ['email'], unique: true },
    search: { type: 'inverted', fields: ['bio'] },
    one: { 
      type: 'link', 
      rel: 'author', 
      object: 'User', 
      indexes: [// must reference named indexes on User schema
        'name', 
        'age', 
        'height', 
        'email'
      ]
    },
    many: { 
      type: 'link', 
      rel: 'comments', 
      object: 'Comment', 
      cascade: 'delete',
      indexes: [
        'date',
        'content'
      ]
    }
  }
};
