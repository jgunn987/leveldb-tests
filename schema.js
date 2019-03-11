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
const schema = {
  name: 'Post',
  extends: 'Entity',
  indexes: {
    name: { type: 'default', fields: 'name' },
    geloc: { type: 'compound', fields: ['long', 'lat'] },
    sub: { type: 'default', fields: 'address.country' },
    uniq: { type: 'default', fields: 'email', unique: true },
    search: { type: 'inverted', fields: 'bio' },
    // how do we foreign key based indexing???
    // a compound index
    one: { type: 'link', fields: 'owner', link: 'User', unique: true, indexes: [
      'name', 'age', 'height', 'email'
    ]},
    many: { type: 'link', fields: 'comments', link: 'Comment', cascade: 'delete' }
  }
};
