const _ = require('lodash');
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

function put(e) {
  const v = JSON.stringify(e);
  return [
    { type: 'put', key: `%${e._type}:${e._id}`, value: v },
    { type: 'put', key: `#${e._type}:${e._v}:${e._id}`, value: v }
  ];
}

function get(e) {
  return e._v === 'latest' ? 
    `%${e._type}:${e._id}` : 
    `#${e._type}:${e._v}:${e._id}`;
}

function del(e) {
  return [{ type: 'put', key: `%${e._type}:${e._id}`, value: 'null' }];
}

const queryMap = {
  '111': (m) => `@spo/${m[0].type}-${m[1].type}-${m[2].type}`, 
  '011': (m) => `@pos/${m[1].type}-${m[2].type}`,
  '001': (m) => `@ops/${m[2].type}`,
  '000': (m) => `@spo/`,
  '010': (m) => `@pos/${m[1].type}`,
  '110': (m) => `@spo/${m[0].type}-${m[1].type}`,
  '100': (m) => `@spo/${m[0].type}`,
  '101': (m) => `@sop/${m[0].type}-${m[2].type}`,
};

function getMatchQuery(m) {
  return queryMap[matchKey(m)](m);
}

function matchKey(m) {
  return (+(m[0] && m[0].type !== '*')).toString() +
    (+(m[1] && m[1].type !== '*')).toString() +
    (+(m[2] && m[2].type !== '*')).toString();
}

const filters = {
  'and': filter => {
    const fns = filter.value.map(getFilterFn);
    return e => fns.every(fn => fn(e)) ? e : false;
  },
  'or': filter => {
    const fns = filter.value.map(getFilterFn);
    return e => fns.some(fn => fn(e)) ? e : false;
  },
  'eq': filter => e => _.get(e, filter.field) === filter.value ? e : false,
  'neq': filter => e => _.get(e, filter.field) !== filter.value ? e : false,
  'gt': filter => e => _.get(e, filter.field) > filter.value ? e : false,
  'gte': filter => e => _.get(e, filter.field) >= filter.value ? e : false,
  'lt': filter => e => _.get(e, filter.field) < filter.value ? e : false,
  'lte': filter => e => _.get(e, filter.field) <= filter.value ? e : false,
  'exists': filter => e => _.has(e, filter.field) ? e : false,
  'nexists': filter => e => !_.has(e, filter.field) ? e : false,
  'nop': filter => e => e
};

function getFilterFn(filter) {
  return filter.type in filters && filter ? 
    filters[filter.type](filter) :
    filters.nop();
}

function compileMatches(m) {
  return m.map(p => Object.assign({}, p, { 
    filter: getFilterFn(p.filter), 
    results: {} 
  }));
}

function deconsMatches(m) {
  return m.length < 3 ? [] : [m.slice(0, 3)].concat(
    deconsMatches(m.slice(2)));
}

function reconsMatches(m) {
  return _.flatten(m.map(p => [p[0], p[1]]))
   .concat(_.last(_.last(m)));
}

function matchResults(m) {
  return m.map(p => _.toPairs(p.results));
}

function assembleQuery(q) {
  return Object.assign({}, q, {
    match: deconsMatches(compileMatches(q.match))
  });
}

function matchResults(m) {
  return m.map(p => _.toPairs(p.results)
    .map(item => item[1]));
}

function disassembleQuery(q) {
  return matchResults(reconsMatches(q.match)
    .filter(p => q.output.indexOf(p.tag) !== -1));
}

function filterTriples(fetch) {
  return spo => triple => {
    const filter = filterTriple(fetch);
    const filterp = filterTriplePredicate(fetch);
    return Promise.all([
      filter(spo[0])(triple[0]),
      filterp(spo[1])(triple),
      filter(spo[2])(triple[2])
    ]).then(results => {
      return [
        [triple[0], results[0]],
        [triple[1], results[1]],
        [triple[2], results[2]]];
    });
  };
}

function filterTriplePredicate(fetch) {
  return spo => triple => 
    triple[1] in spo.results ?
      spo.results[triple[1]] :
      spo.filter(triple[3] || {});
}

function filterTriple(fetch) {
  return spo => async id => 
    id in spo.results ?
      spo.results[id] :
      spo.filter(await fetch(id));
}

function processTriple(fetch) {
  return spo => triple => {
    return filterTriples(fetch)(spo)(triple)
      .then(result => {
        if(!result.find(r => !r[1])) {
          return result;
        }
      });
  };
}

function processResults(spo) {
  return results => {
    results.filter(Boolean).forEach(r => {
      spo[0].results[r[0][0]] = r[0][1];
      spo[1].results[r[1][0]] = r[1][1];
      spo[2].results[r[2][0]] = r[2][1];
    });
    return spo;
  };
}

function execQuery(spo) {
  return scan => fetch => new Promise((resolve, reject) => {
    const ops = [];
    const processor = processTriple(fetch)(spo);
    const postProcessor = processResults(spo);
    scan(getMatchQuery(spo))
      .on('error', reject)
      .on('data', (triple) => {
        ops.push(processor(triple));
      })
      .on('end', () => {
        Promise.all(ops).then(postProcessor)
          .then(resolve);
      });
  });
}

function execSingleQuery(q) {
  return scan => fetch => new Promise((resolve, reject) => {
    const docs = [];
    const filter = getFilterFn(q.match[0].filter);
    const qs = q.match[0].type === '*' ? 
      '%' : `%${q.match[0].type}:`;

    scan(qs).on('error', reject)
      .on('end', () => resolve(docs))
      .on('data', e => {
        if(filter(e)) docs.push(e);
      });
  });
}

function query(q) {
  if(q.match.length === 1) {
    return q.output && q.output.indexOf(q.match[0].tag) !== -1 ?
      scan => fetch => execSingleQuery(q)(scan)(fetch):
      scan => fetch => Promise.resolve([]);
  }

  // (first triple) collects subjects, collects objects
  // (> first triple) filters subjects, collects objects
  // if at any point in any query no objects are found, return empty
  const prepared = assembleQuery(q);
  const pipeline = prepared.match.map(m => execQuery(m));
  return scan => fetch => 
    Promise.all(pipeline.map(p => p(scan)(fetch)))
      .then(match => Object.assign({}, prepared, { match }))
      .then(disassembleQuery);
}

module.exports = {
  entity,
  put,
  putLink: generateLinkKeys('put'),
  get,
  del,
  delLink: generateLinkKeys('del'),
  query
};
