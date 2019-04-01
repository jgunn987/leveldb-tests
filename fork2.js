const _ = require('lodash');
const jmespath = require('jmespath');
const uuid = require('uuid');

function entity(e = {}) {
  return { 
    _type: e._type || 'Entity',
    _id: e._id || uuid.v4(), 
    _v: e._v || (+new Date()).toString(),
    ...e
  };
}

function generateLinkKeys(type) {
  return link => {
    const [s, sid] = link[0].split(':');
    const [o, oid] = link[2].split(':');
    const linkJSON = JSON.stringify(link);
    return [
      { type, key: `@pso/${link[1]}-${s}-${o}:${sid}:${oid}`, value: linkJSON },
      { type, key: `@pos/${link[1]}-${o}-${s}:${sid}:${oid}`, value: linkJSON },
      { type, key: `@spo/${s}-${link[1]}-${o}-${sid}:${oid}`, value: linkJSON },
      { type, key: `@ops/${o}-${link[1]}-${s}:${sid}:${oid}`, value: linkJSON },
      { type, key: `@sop/${s}-${o}-${link[1]}:${sid}:${oid}`, value: linkJSON },
      { type, key: `@osp/${o}-${s}-${link[1]}:${sid}:${oid}`, value: linkJSON }
    ];
  };
}

const putLink = generateLinkKeys('put');
const delLink = generateLinkKeys('del');

function put(e) {
  const v = JSON.stringify(e);
  return [
    { type: 'put', key: `%${e._type}:${e._id}`, value: v },
    { type: 'put', key: `%${e._type}/$v/${e._v}:${e._id}`, value: v }
  ];
}

function get(e) {
  return e._v === 'latest' ? 
    `%${e._type}:${e._id}` : 
    `%${e._type}/$v/${e._v}:${e._id}`;
}

function del(e) {
  return [{ type: 'put', key: `%${e._type}:${e._id}`, value: 'null' }];
}

const registerMap = {
  '111': (m) => `@spo/${m[0].type}-${m[1].type}-${m[2].type}`, 
  '011': (m) => `@pos/${m[1].type}-${m[2].type}`,
  '001': (m) => `@ops/${m[2].type}`,
  '000': (m) => `@spo/`,
  '010': (m) => `@pos/${m[1].type}`,
  '110': (m) => `@spo/${m[0].type}-${m[1].type}`,
  '100': (m) => `@spo/${m[0].type}`,
  '101': (m) => `@sop/${m[0].type}-${m[2].type}`,
};

const filters = {
  'and': filter => {
    const fns = filter.value.map(getFilterFn);
    return e => fns.every(fn => fn(e));
  },
  'or': filter => {
    const fns = filter.value.map(getFilterFn);
    return e => fns.some(fn => fn(e));
  },
  'eq': filter => e => e[filter.field] === filter.value,
  'neq': filter => e => e[filter.field] !== filter.value,
  'gt': filter => e => e[filter.field] > filter.value,
  'gte': filter => e => e[filter.field] >= filter.value,
  'lt': filter => e => e[filter.field] < filter.value,
  'lte': filter => e => e[filter.field] <= filter.value,
  'exists': filter => e => filter.field in e,
  'nexists': filter => e => !(filter.field in e),
  'nop': filter => e => true
};

function getFilterFn(filter) {
  return filter.type in filters ? 
    filters[filter.type](filter) :
    filters.nop();
}

function getQueryMatchRegister(m) {
  return registerMap[
    (+(m[0] && m[0].type !== '*')).toString() +
    (+(m[1] && m[1].type !== '*')).toString() +
    (+(m[2] && m[2].type !== '*')).toString()](m);
}

function deconsQueryLinks(s) {
  return s.length < 3 ? [] : [s.slice(0, 3)].concat(
    deconsQueryLinks(s.slice(2)));
}

function compileQueryLinks(match) {
  return match.map(p => Object.assign({}, p, { 
    filter: getFilterFn(p.filter), 
    results: {} 
  }));
}

function getNode(db) {
  return async l => {
    const [_type, _id] = l.split(':');
    return JSON.parse(await db.get(get(entity({
      _id, _type, _v: 'latest'
    }))));
  };
}

function getAll(db) {
  return q => link =>
    Promise.all([
      link[0] in q[0].results ?
        q[0].results[link[0]] : getNode(db)(link[0]),
      link[1] in q[1].results ?
        q[1].results[link[1]] : link[3] || {},
      link[2] in q[2].results ?
        q[2].results[link[2]] : getNode(db)(link[2])
    ]);
}

function filterAll(q) {
  return link => spo => {
    if(q[0].filter(spo[0]) &&
       q[1].filter(spo[1]) &&
       q[2].filter(spo[2])) {
      q[0].results[link[0]] = spo[0];
      q[1].results[link[1]] = spo[1];
      q[2].results[link[2]] = spo[2];
    }
    return q;
  };
}

function processQuery(db) {
  return q => link => 
    getAll(db)(q)(link).then(filterAll(q)(link));
}

function createQueryOp(db) {
  return q => {
    const qs = getQueryMatchRegister(q);
    const qr = [];
    return new Promise((resolve, reject) =>
      db.createReadStream({ gte: qs, lte: qs + '~' })
        .on('error', reject)
        .on('data', data => {
          qr.push(processQuery(db)(q)(JSON.parse(data.value)));
        }).on('end', () => {
          Promise.all(qr).then(() => resolve(q));
        }));
  };
}

function compileQueryOps(q) {
  return deconsQueryLinks(compileQueryLinks(q.match))
    .map(p => db => createQueryOp(db)(p))
}

function query(q) {
  return async db => {
    const result = await Promise.all(
      compileQueryOps(q).map(fn => fn(db)
    ));
    return _.flatten(result.map(r => r
      .filter(p => q.output.indexOf(p.tag) !== -1)
      .map(p => _.toPairs(p.results))));
  };
}

const assert = require('assert');
const level = require('level');
const db = level('/tmp/graph-db-test');

(async function () {
  await db.batch([
    ...put(entity({ _id: 1, _type: 'Person', name: 'James' })),
    ...put(entity({ _id: 2, _type: 'Person', name: 'Sue' })),
    ...put(entity({ _id: 1, _type: 'Food', type: 'Banana' })),
    ...putLink(['Person:1', 'likes', 'Person:2']),
    ...putLink(['Person:1', 'hates', 'Food:1']),
    ...putLink(['Person:2', 'hates', 'Food:1']),
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
      } }
    ],
    output: ['a', 'c']
  })(db);

  q.then(r => {
    console.log(r);
  });

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
