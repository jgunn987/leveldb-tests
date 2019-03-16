const _ = require('lodash');
const { Transform } = require('stream');
const db = require('level')('/tmp/streamdb');
const { diff } = require('./schema');
const mergeStream = require('merge-stream');

const schema1 = {
  name: 'Post',
  indexes: {
    title: { type: 'default', fields: ['title'] },
    createdAt: { type: 'default', fields: ['createdAt'] },
    text: { type: 'inverted', fields: ['text'] }
  }
};

const schema2 = {
  name: 'Post',
  indexes: {
    title: { type: 'default', fields: ['a.title'] },
    text: { type: 'inverted', fields: ['text'] },
    author: { type: 'default', fields: ['author'] }
  }
};
