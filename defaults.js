const jmespath = require('jmespath');
const keys = require('./keys');

module.exports.index = (db, schema, name, options, doc) =>
  [ keys.index(schema.name, name,
      options.fields.map((field) =>
        jmespath.search(doc, field) || 'NULL').join('&'), 
      !options.unique && doc._id) ];
