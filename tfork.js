const assert = require('assert');
const { Transform } = require('stream');
const level = require('level');
const db = level('/tmp/graph-db-test');
const { entity, put, get, del, putLink, delLink, query }
  = require('./fork');

function transformer(fn) {
  return new Transform({ objectMode: true, transform: fn });
}

(async function () {
  await db.batch([
    ...put(entity({ _id: 0, _type: 'Person', name: 'God' })),
    ...put(entity({ _id: 1, _type: 'Person', name: 'James' })),
    ...put(entity({ _id: 2, _type: 'Person', name: 'Sue' })),
    ...put(entity({ _id: 3, _type: 'Person', name: 'Suey' })),
    ...put(entity({ _id: 1, _type: 'Food', type: 'Banana' })),
    ...put(entity({ _id: 1, _type: 'Country', name: 'Brazil' })),
    ...putLink(['Person:0', 'likes', 'Person:1']),
    ...putLink(['Person:1', 'likes', 'Person:2']),
    ...putLink(['Person:1', 'hates', 'Food:1']),
    ...putLink(['Person:2', 'hates', 'Food:1']),
    ...putLink(['Person:0', 'likes', 'Food:1']),
    ...putLink(['Person:3', 'hates', 'Food:1']),
    ...putLink(['Food:1', 'from', 'Country:1']),
  ]);

  const q = query({
    match:[
      { tag: 'a', type: 'Person', filter: {
        type: 'and', value: [
          { type: 'eq', field: 'name', value: 'James' },
          { type: 'neq', field: 'name', value: 'Jam' },
          { type: 'neq', field: 'name', value: 'Ja' },
          { type: 'neq', field: 'name', value: 'Jaes' },
        ]
      } },
      { tag: 'r', type: 'likes', filter: {} }, 
      { tag: 'b', type: 'Person', filter: {
        type: 'and', value: [
          { type: 'eq', field: 'name', value: 'Sue' },
        ]
      } },
      { tag: 'r2', type: 'hates', filter: {} },
      { tag: 'c', type: 'Food', filter: {
        type: 'eq', field: 'type', value: 'Banana'
      } },
      { tag: 'r2', type: 'from', filter: {} },
      { tag: 'd', type: 'Country', filter: {
        type: 'eq', field: 'name', value: 'Brazil'
      } },
    ],
    output: ['a', 'b', 'c', 'd']
  });

  function scan(qs) {
    return db.createReadStream({      
      gte: qs, lt: qs + '~'
    }).pipe(transformer(function (data, enc, done) {
      this.push(JSON.parse(data.value));
      done();
    }));
  }

  async function fetch(id) {
    const [_type, _id] = id.split(':');
    return JSON.parse(await db.get(get(entity({
      _type, _id, _v: 'latest'
    }))));
  }

  console.log(await q(scan)(fetch));

  const q2 = query({
    match:[
      { tag: 'a', type: 'Person', filter: {
        type: 'and', value: [
          { type: 'eq', field: 'name', value: 'James' },
          { type: 'neq', field: 'name', value: 'Jam' },
          { type: 'neq', field: 'name', value: 'Ja' },
          { type: 'neq', field: 'name', value: 'Jaes' },
        ]
      } },
    ],
    output: ['a']
  });

  console.log(await q2(scan)(fetch));

})();

/*
query([
  match('a', 'Person', 
    intersection([
      eq('name', 'James'),
      neq('age', '21')
      union([
        gt('length', 100),
        lt('length', 200
      ])
    ])),
  match('r', 'likes'),
  match('b', 'Person', 
    intersection([
      eq('name', 'Sue')
    ])),
  match('r2', 'hates'),
  match('c', 'Food', 
    eq('type', 'Banana'))
])(['a', 'c'])(db);
*/
