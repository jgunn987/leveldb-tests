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
// 
// allow disallow extra unindexed fields, JSON
const schema = {
  name: 'Post',
  extends: 'Entity',
  retainUndefined: true, // keep extra fields
  indexes: {
    name: { fields: 'name' },
    geloc: { fields: ['long', 'lat'] },
    sub: { fields: 'address.country' },
    uniq: { fields: 'email', unique: true },
    search: { fields: ['bio', 'description'], inverted: true },
    one: { fields: 'owner', link: 'User', unique: true },
    many: { fields: 'comments', link: 'Comment', cascade: 'delete' }
  }
};
