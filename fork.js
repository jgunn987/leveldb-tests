const _ = require('lodash');
const jmespath = require('jmespath');
const uuid = require('uuid');

function createDoc(doc = {}) {
  return { 
    _id: doc._id || uuid.v4(), 
    _v: (+new Date()).toString(),
    _links: doc._links || { put: [], del: [] },
    ...doc
  };
}

function docLatestBaseKey(type) {
  return `%${type}:`;
}

function docLatestKey(type, uuid) {
  return `${docLatestBaseKey(type)}${uuid}`;
}
  
function docKey(type, uuid, version) {
  return `%${type}/$v/${version}:${uuid}`;
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
    linkKey('spo', stype, link[1], otype, sid, oid),
    linkKey('sop', stype, otype, link[1], sid, oid), 
    linkKey('pso', link[1], stype, otype, sid, oid),
    linkKey('pos', link[1], otype, stype, sid, oid),
    linkKey('ops', otype, link[1], stype, sid, oid), 
    linkKey('osp', otype, stype, link[1], sid, oid)
  ];
}

function linkOp(sid, type) {
  return link => {
    const fullLink = [sid].concat(link);
    const fullLinkJSON = JSON.stringify(fullLink);
    return generateLinkKeys(fullLink)
      .map(key => ({ type, key, value: fullLinkJSON }));
  };
}

function generateLinkOps(sid, links) {
  return _.flatten((links.put || []).map(linkOp(sid, 'put')))
    .concat(_.flatten((links.del || []).map(linkOp(sid, 'del'))));
}

async function put(db, type, doc) {
  const d = createDoc(doc);
  const v = JSON.stringify(d);
  await db.batch([
    { type: 'put', key: docLatestKey(type, d._id), value: v },
    { type: 'put', key: docKey(type, d._id, d._v), value: v },
    ...generateLinkOps(type + ':' + d._id, d._links) 
  ]);
  return d._id;
}

async function get(db, type, id, version) {
  return JSON.parse(version ?
    await db.get(docKey(type, id, version)):
    await db.get(docLatestKey(type, id)));
}

async function del(db, type, id) {
  return db.batch([{ type: 'put', key: docLatestKey(type, id), value: 'null' }]);
}

function query(db, q) {
  const path = deconsLinkQuery(q.match)
    .map(m => m.map(p => _.reverse(p.split(':'))))
    .map(m => linkKeyFirstSecondThird('spo', m[0][0], m[1][0], m[2][0]))
    .map(m => db.createReadStream({ gte: m, lt: m + '~' }));

  path[0].on('data', console.log);
}

function deconsLinkQuery(s) {
  return s.length < 3 ? [] : [s.slice(0, 3)].concat(
    deconsLinkQuery(s.slice(2)));
}

const assert = require('assert');
const level = require('level');
const db = level('/tmp/graph-db-test');

Promise.all([
  put(db, 'Entity', { name: 'James', _links: {
    put: [['loves', 'Entity:1']]
  } }),
  put(db, 'Entity', { name: 'John', _links: {
    put: [
      ['hates', 'Entity:5'],
      ['hates', 'Entity:6'],
      ['hates', 'Entity:7'],
      ['hates', 'Entity:8'],
      ['hates', 'Entity:9'],
    ]
  } }),
  put(db, 'Entity', { name: 'Sue' }),
  put(db, 'Entity', { name: 'Tim' }),
  put(db, 'Entity', { name: 'Joanne' }),
  put(db, 'Entity', { name: 'Mark' }),
]).then((ids) => {
  query(db, {
    match: ['a:Entity', 'hates', 'b:Entity'],
    filters: [
      { tag: 'a', filter: '' }
    ]
  });
});

