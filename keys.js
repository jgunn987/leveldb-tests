module.exports.metadata = () =>
  `#metadata`;

module.exports.log = (txid) =>
  `#${txid}`;

module.exports.count = (table) =>
  `%${table}/$count`;

module.exports.schemaLatest = (table) =>
  `%${table}/$schema/latest`;

module.exports.schema = (table, version) =>
  `%${table}/$schema:${version}`;

module.exports.documentLatest = (table, uuid) =>
  `%${table}/$latest:${uuid}`;
  
module.exports.document = (table, uuid, version) =>
  `%${table}/$v/${version}:${uuid}`;

module.exports.index = (table, indexName) =>
  `%${table}/$i/${indexName}`;
