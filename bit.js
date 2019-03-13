const level = require('level');
const db = level('/tmp/bit-db');

function testOrQuery() {
  return query('Entity')
    .where((q) => 
      q.or([
        q.eq('name', 'james'),
        q.neq('age', 25) 
        q.gt('name', 'jame'),
        q.gte('name', 'jam'),
        q.lt('name', 'ja'),
        q.lte('name', 'j'),
        q.between('loc', '12.3458', '114.4489')
      ])));
}

function binary(str) {
  return str.split('').map((c) =>
    c.charCodeAt(0).toString(2)).join('');
}

function getQueryResult(name, ...params) {
  //return `${name}(${params.sort().join(',')})`;
  return `${name}(${params.join(',')})`;
}

console.log(getQueryResult('Query1', 'big', 'fat', 'dog'));
console.log(getQueryResult('Query1', 'one', 'big', 'name'));
console.log(getQueryResult('Query1', 'your', 'and', 'big'));
console.log(getQueryResult('Query1', 'a', 'e', 'e'));

console.log([
  '1010100010101010$1010101010$10101010',
  '1010101010$101010$10101010',
  '10101$10101010$10101010',
].sort());
/*
const a = 'a';
const b = 'b';
const c = 'c';
const d = 'd';
console.log([a, b, c].sort());
console.log([b, c, a].sort());
console.log([b, a, c].sort());
console.log([c, b, a].sort());
console.log([c, a, b].sort());
console.log([d, d, d].sort());
*/


