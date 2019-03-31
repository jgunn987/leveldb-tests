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
    seen: new Set(),
    results: [], 
  }));
}

function compileQueryOps(q) {
  return deconsQueryLinks(compileQueryLinks(q.match))
    .map(p => db => new Promise((resolve, reject) => {
      const qs = getQueryMatchRegister(p);
      db.createReadStream({ gte: qs, lte: qs + '~' })
        .on('end', () => resolve(p))
        .on('error', reject)
        .on('data', data => {
          const link = JSON.parse(data.value);
          if(!p[0].seen.has(link[0])) {
            p[0].seen.add(link[0]);
            p[0].results.push(link[0]);
          }

          if(!p[1].seen.has(link[1])) {
            p[1].seen.add(link[1]);
            p[1].results.push(link[1]);
          }

          if(!p[2].seen.has(link[2])) {
            p[2].seen.add(link[2]);
            p[2].results.push(link[2]);
          }
        });
    })); 
}

function query(q) {
  return db => compileQueryOps(q).map(fn => fn(db));
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
    get: ['a']
  })(db);

  Promise.all(q).then(console.log);

})();
/*
query([
  subject('Person', 'a', and([
    eq('name', 'James'),
    eq('age', 'James'),
    eq('number', 'James'),
    eq('dob', 'James'),
    eq('sign', 'James'),
  ]))
  .predicate('Likes', 'b')
  .object('*', 'c', or([
    eq('name', 'Sue'),
    eq('age', 'James'),
  ]))
], ['a', 'c']);*/
