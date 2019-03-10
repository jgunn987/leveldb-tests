Replication, raft
Master/Slave clusters
Sharding/Partitioning
Document Versioning
Transactions, MVCC
Views
Counts, indexes, unique constraints
Atomic operations
Geospatial indexing
Time window indexing
Publish/Subscribe/webhooks/callbacks
Security, Authentication, Authorization, Policies, RBAC ABAC
Migrations
TTL

VACUUMING: we can know when to delete old versions based on read timestamps and open transactions, e.g who is reading a version?
consider support for materialized path indexing, ie
when a path hierarchy is changed all docs need to be updated to reflect that change
also what about searching under a given category/materialised path/partition?
consider composite indexes e.g,
long:55.00092 lat:30:38393 => 55.00092:30.38393

// take out the in memory implementations of redis
// take out the leveldb or rocks db good parts for durability
// create c extensions for certain plugins or indexers
// use or fork node to act as the server/networking component of the db
// add optional indexing for specific query options, i.e. full scan, index, index at certian points etc
// extensible schemas e.g CREATE TABLE User EXTENDS SuperUser
// optional storage of unindexed data eg json with a keyword e.g NO_EXTRA
// built in security/user module, RBAC ABAC modules
// create a database contains an intersection of all db types and optimizations for each, e.g roles such as search based, graph, relational, kv, cache
// use ZFS for reliability, other file systems are prone to corruption

const model = new Entity('User')
model.ttl() // enable ttl for this entity
model.cascade('comments', 'delete')
model.uniqueIndex('name');
model.index('name');
model.compoundIndex('long', 'lat'); // these should be created for multiple AND's.
model.hasOne('address', 'Address');
model.uniqueIndex('address');
model.invertedIndex('bio');
model.hasMany('friends', 'Friend'); // what if entity has 1000 friends? are the pointers all stored in document??
                                    // there must be and add/remove function on this level
                                    // sets or lists updates follow the format { $add: [...], $remove: [...] }

key space layout
================

system

type     | template                             | notes
---------|--------------------------------------|--------------------
metadata | #metadata => {tables, topology, etc} | used to boot the db
log      | #{logId} => {operations}             | replicated log

boot order
* load metadata
* load schemas
* load counters
* serve

document tables

type                 | key template | value
---------------------|--------------|------
count                | %{table.name}/$count | {int} 
latest schema        | %{table.name}/$schema/latest | {schema}
schema versions      | %{table.name}/$schema:{schema.txid} | {schema}
latest version       | %{table.name}/$latest:{doc.uuid} | {doc}
versions log         | %{table.name}/$v/{doc.txid}:{doc.uuid} | {doc}
default index        | %{table.name}/$i/{index.name}:{value}:{doc.uuid} | @{doc.uuid}
unique indexes       | %{table.name}/$i/{index.name}:{value} | @{doc.uuid}
inverted indexes     | %{table.name}/$i/{index.name}:{token}:{doc.uuid} | @{doc.uuid}
compound indexes     | %{table.name}/$i/{index.name}:{value1};{value2};{...}:{doc.uuid} | @{doc.uuid}
has one              | %{table.name}/$i/{index.name}:{rel.uuid}:{doc.uuid} | @{doc.uuid}
has one unique       | %{table.name}/$i/{index.name}:{rel.uuid} | @{doc.uuid}
has many             | %{table.name}/$i/{index.name}:{rel.uuid}:{doc.uuid} | @{doc.uuid}
has many unique      | %{table.name}/$i/{index.name}:{rel.uuid} | @{doc.uuid}

// with inverted indexes we can cache queries, e.g %{table.name}/$q/{index.name}:"some sub string"


query syntax
======================

select({entity.name})
where(
    
