const client = require('./client');
const server = require('./server');
const stream = require('stream');
const extend = require('xtend');
const AbstractLevelDOWN = require('abstract-leveldown').AbstractLevelDOWN;
const LevelUP = require('levelup');

class LevelNetDOWN extends AbstractLevelDOWN {
  constructor(options) {
    super(options);
  }

  _open(options, done) {
  }

  _close(done) {
  }

  _get(k, options, done) {
  }
  
  _put(k, v, options, done) {
  }

  _del(k, options, done) {
  }

  _batch(ops, options, done) {
  }
}

module.exports = function (options) {
  return new LevelNetUP(new LevelNetDOWN(options), options);
};
