const level = require('level');
const client = require('./client');
const server = require('./server');

const db1 = level('/tmp/db1', {
  valueEncoding: 'utf8' });
const db2 = level('/tmp/db2', {
  valueEncoding: 'utf8' });
const db3 = level('/tmp/db3', {
  valueEncoding: 'utf8' });

const puts = Promise.all([
  db1.put('#log:key1', JSON.stringify({ 
    type: 'put', key: 'key1', value: 'value1' })),
  db1.put('#log:key2', JSON.stringify({ 
    type: 'put', key: 'key2', value: 'value2' })),
  db1.put('#log:key3', JSON.stringify({ 
    type: 'put', key: 'key3', value: 'value3' })),
  db1.put('#log:key4', JSON.stringify({ 
    type: 'put', key: 'key4', value: 'value4' })),
  db1.put('#log:key5', JSON.stringify({ 
    type: 'put', key: 'key5', value: 'value5' })),
  db1.put('#log:key6', JSON.stringify({ 
    type: 'put', key: 'key6', value: 'value6' })),
  db1.put('#log:key7', JSON.stringify({ 
    type: 'put', key: 'key7', value: 'value7' })),
]);

const server1 = server(db1).listen(3337);
const client1 = client(db2).connect({ port: 3337 });
const client2 = client(db3).connect({ port: 3337 });

for (let i=9; i < 100; ++i) 
  db1.put('#log:key' + i, JSON.stringify({ 
    type: 'put', key: 'key1', value: 'value1' })),

setTimeout(() =>
  server1.broadcast(JSON.stringify({
    type: 'log', key: '#log:key3', value: {
      type: 'put', key: 'key3', value: 'value3'
    }
  })), 500);
