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
    title: { type: 'default', fields: ['title'] },
    text: { type: 'inverted', fields: ['text'] },
    author: { type: 'default', fields: ['author'] }
  }
});

assert.ok(ops[0].type === 'drop');
assert.ok(ops[0].table === 'Post');
assert.ok(ops[0].index === 'createdAt');
assert.ok(ops[1].type === 'create');
assert.ok(ops[1].table === 'Post');
assert.ok(ops[1].index === 'author');
