const _ = require('lodash');
const jmespath = require('jmespath');
const uuid = require('uuid');

function entity(doc = {}) {
  return { 
    _type: doc._type || 'Entity',
    _id: doc._id || uuid.v4(), 
    _v: doc._v || (+new Date()).toString(),
    _links: doc._links || { put: [], del: [] },
    ...doc
  };
}

function docBaseKey(doc) {
  return `%${doc._type}:`;
}

function docLatestKey(doc) {
  return `${docBaseKey(doc)}${doc._id}`;
}
  
function docKey(doc) {
  return `%${doc._type}/$v/${doc._v}:${doc._id}`;
}

function docTypeIdKey(doc) {
  return `${doc._type}:${doc._id}`;
}

function linkKeyFirst(register, s) {
  return `@${register}/${s}`;
}

function linkKeyFirstSecond(register, s, p) {
  return `${linkKeyFirst(register, s)}-${p}`;
}

function linkKeyFirstSecondThird(register, s, p, o) {
  return `${linkKeyFirstSecond(register, s, p)}-${o}`;
}

function linkKey(register, s, p, o, sid, oid) {
  return `${linkKeyFirstSecondThird(register, s, p, o)}:${sid}:${oid}`;
}

function generateLinkKeys(link) {
  const [stype, sid] = link[0].split(':');
  const [otype, oid] = link[2].split(':');
  return [
    [linkKey('spo', stype, link[1], otype, sid, oid), link],
    [linkKey('sop', stype, otype, link[1], sid, oid), link],
    [linkKey('pso', link[1], stype, otype, sid, oid), link],
    [linkKey('pos', link[1], otype, stype, sid, oid), link],
    [linkKey('ops', otype, link[1], stype, sid, oid), link],
    [linkKey('osp', otype, stype, link[1], sid, oid), link]
  ];
}

function generateLinkOps(type) {
  return doc => _.flatten((doc._links[type] || [])
    .map(l => [docTypeIdKey(doc)].concat(l))
    .map(generateLinkKeys)
    .map(l => l.map(k => ({ 
        type, key: k[0], value: JSON.stringify(k[1]) 
      }))));
}

const generatePutLinkOps = generateLinkOps('put');
const generateDelLinkOps = generateLinkOps('del');

function put(doc) {
  const v = JSON.stringify(doc);
  return [
    { type: 'put', key: docLatestKey(doc), value: v },
    { type: 'put', key: docKey(doc), value: v },
    ...generatePutLinkOps(doc),
    ...generateDelLinkOps(doc)
  ];
}

function get(doc) {
  return doc._v === 'latest' ? docLatestKey(doc) : docKey(doc);
}

function del(doc) {
  return [{ type: 'put', key: docLatestKey(doc), value: 'null' }];
}

function deconsLinkQuery(s) {
  return s.length < 3 ? [] : [s.slice(0, 3)].concat(
    deconsLinkQuery(s.slice(2)));
}

const registerMap = {
  '111': (m) => linkKeyFirstSecondThird('spo', m[0].type, m[1].type, m[2].type), 
  '011': (m) => linkKeyFirstSecond('pos', m[1].type, m[2].type),
  '001': (m) => linkKeyFirst('ops', m[2].type),
  '000': (m) => `@spo/`,
  '010': (m) => linkKeyFirst('pos', m[1].type),
  '110': (m) => linkKeyFirstSecond('spo', m[0].type, m[1].type),
  '100': (m) => linkKeyFirst('spo', m[0].type),
  '101': (m) => linkKeyFirstSecond('sop', m[0].type, m[2].type),
};

function getRegister(m) {
  return registerMap[
    (+(m[0] && m[0].type !== '*')).toString() +
    (+(m[1] && m[1].type !== '*')).toString() +
    (+(m[2] && m[2].type !== '*')).toString()](m);
}

function getQueryMatchRegisters(m) {
  return getRegister(m);
}

function query(q) {
  return deconsLinkQuery(q)
    .map(p => db => {
      const reg = getQueryMatchRegisters(p);
      db.createReadStream({ gte: reg, lte: reg + '~' })
        .on('data', async data => {
          const link = JSON.parse(data.value);
          const [stype, sid] = link[0].split(':');
          const [otype, oid] = link[2].split(':');
          const s = JSON.parse(await db.get(get(entity({ 
            _type: stype, _id: sid, _v: 'latest' 
          }))));
          const o = JSON.parse(await db.get(get(entity({ 
            _type: otype, _id: oid, _v: 'latest' 
          }))));
        });
    });
}

const assert = require('assert');
const level = require('level');
const db = level('/tmp/graph-db-test');

(async function () {
  const sue = entity({ _id: 1, _type: 'Person', name: 'Sue', _links: { 
    put: [
      ['loves', 'Person:1'],
      ['likes', 'Person:2']
    ]
  } });
  const james = entity({ _id: 2, _type: 'Person', details: { name: 'James' }, _links: { 
    put: [
      ['likes', 'Person:1']
    ]
  } });


  await db.batch(put(sue));
  await db.batch(put(james));

  get(entity({ _id: 1, _v: 'latest' }));
  del(entity({ _id: 1 }));
//db.createReadStream().on('data', console.log);
  query([
    { tag: 'a', type: 'Person', filter: [
      { type: 'eq', field: 'name', values: ['James'] }
    ] },
    { tag: 'r', type: 'likes' }, 
    { tag: 'b', type: 'Person' },
  ])[0](db)

})();
