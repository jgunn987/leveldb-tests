const assert = require('assert');
const { diff } = require('./../schema');

const ops = diff({ 
  name: 'Post',
  indexes: {
    title: { type: 'default', fields: ['title'] },
    createdAt: { type: 'default', fields: ['createdAt'] },
    text: { type: 'inverted', fields: ['text'] }
  }
}, {
  name: 'Post',
  indexes: {
    title: { type: 'default', fields: ['a.title'] },
    text: { type: 'inverted', fields: ['text'] },
    author: { type: 'default', fields: ['author'] }
  }
});

assert.ok(ops[0].type === 'dropIndex');
assert.ok(ops[0].table === 'Post');
assert.ok(ops[0].index === 'title');
assert.ok(ops[1].type === 'dropIndex');
assert.ok(ops[1].table === 'Post');
assert.ok(ops[1].index === 'createdAt');
assert.ok(ops[2].type === 'createIndex');
assert.ok(ops[2].table === 'Post');
assert.ok(ops[2].index === 'title');
assert.ok(ops[3].type === 'createIndex');
assert.ok(ops[3].table === 'Post');
assert.ok(ops[3].index === 'author');
