Replication, raft
Master/Slave clusters
Sharding/Partitioning
Document Versioning
Transactions, MVCC
Views
Counts, indexes, unique constraints
Bitmap indexes
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

model.compoundIndex('long', 'lat'); // these should be created for multiple AND's.
model.hasMany('friends', 'Friend'); // what if entity has 1000 friends? are the pointers all stored in document??
                                    // there must be and add/remove function on this level
                                    // sets or lists updates follow the format { $put: [...], $del: [...] }

{en,de}crypt, enable on values
Simdjson, for parsing json


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

TODO: add schema support for embeddeing documents under index keys

type                 | key template | value
---------------------|--------------|------
count                | %{table.name}/$count | {int} 
latest schema        | %{table.name}/$schema/latest | {schema}
schema versions      | %{table.name}/$schema:{schema.txid} | {schema}
latest version       | %{table.name}:{doc.uuid} | {doc}
versions log         | %{table.name}/$v/{doc.txid}:{doc.uuid} | {doc}
default index        | %{table.name}/$i/{index.name}:{value}:{doc.uuid} | @{doc.uuid} | {doc}
unique indexes       | %{table.name}/$i/{index.name}:{value} | @{doc.uuid} | {doc}
inverted indexes     | %{table.name}/$i/{index.name}:{token}:{doc.uuid} | @{doc.uuid} | {doc}
compound indexes     | %{table.name}/$i/{index.name}:{value1}&{value2}&{...}:{doc.uuid} | @{doc.uuid} | {doc}
links indexing       | %{table.name}/$@/{subject.uuid}:{subject.predicate}/$i/{index.name}:{value}:{doc.uuid} | @{doc.uuid} | {doc}

graph links(hexastore)

type | template | value
-----|----------|-------
sop  | @sop/{subject.uuid}-{object.uuid}-{predicate} | {spo}
spo  | @spo/{subject.uuid}-{predicate}-{object.uuid} | {spo}
pso  | @pso/{predicate}-{subject.uuid}-{object.uuid} | {spo}
pos  | @pos/{predicate}-{object.uuid}-{subject.uuid} | {spo}
ops  | @ops/{object.uuid}-{predicate}-{subject.uuid} | {spo}
osp  | @osp/{object.uuid}-{subject.uuid}-{predicate} | {spo} 


support query functions e.g
q.fn('abs', value)

```javascript
function testOrQuery() {
  return query('Entity')
    .filter((q) => 
      q.union([ //OR
        q.eq('name', 'james'),
        q.eq('name', 'jame'),
        q.eq('name', 'jam'),
        q.eq('name', 'ja'),
        q.eq('name', 'j'),
        q.gt('age', 25), 
        q.within('loc', '12.3458', '114.4489'),
        q.without('loc', '12.3458', '114.4489'),
        q.match('email', '*@{1}.*'),
        q.intersection([ //AND
          q.eq('name', 'gam'),
          q.eq('name', 'ga'),
          q.eq('name', 'g'),
        ])
      ]))
    .project('comments', 'Comment', (q) =>
        q.filter((q) => 
          q.intersection([
            q.search('text', 'Cool Beans'),
            q.lte('number', 1),
            q.eq('name', 'gam'),
            q.eq('name', 'ga'),
            q.eq('name', 'g'),
          ])
        .projection('author', 'Author', (q) =>
          q.filter(q) =>
            q.eq('name', 'James'))
        .order('date', 'asc')
        .limit(100))
    .order('date', 'asc')
    .limit(100);
}
```
