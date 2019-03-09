const level = require('level');
const ttl = require('./ttl');
const mvcc = require('./mvcc');
const view = require('./view');
const inverted = require('./inverted');
const orm = require('./orm');
const db = inverted(mvcc(view(ttl(level('/tmp/db-test', {
  valueEncoding: 'utf8' 
})))));

/*
Promise.all([
  db.invertedIndex('entity:1', 'entity', `
    And the earth was without form, and void; and darkness was upon the face of the deep. 
    And the Spirit of God moved upon the face of the waters.`),
  db.invertedIndex('entity:2', 'entity', `
    And the earth was without form, and void; and darkness was upon the face of the deep. 
    And the Spirit of God moved upon the face of the waters. Jesus`),
  db.invertedIndex('entity:3', 'entity', 'nasty'),
  db.invertedIndex('entity:4', 'entity', 'bad man'),
  db.put('entity:4', '{ doc4 }'),
  db.put('entity:3', '{ doc3 }'),
  db.put('entity:2', '{ doc2 }'),
  db.put('entity:1', '{ doc1 }'),
]).then(async () => 
  console.log(await db.search('god void', 'entity')))
*/

/*

model.mapReduce('myMappedIndex', function (e, emit) {
  emit('index.count', e);
}, function (p, doc, emit) {
  emit('index:count', p + doc.someNum);
});
*/
/*
const tid = db.getTid();
const ts = db.getTidTimestamp(tid);
const id = db.getTidCount(tid);
console.log(Number(id));
console.log(new Date(Number(ts)));

db.batch()
  .put('#doc:1/15518843922520000000000000001', JSON.stringify({
      _rts: +new Date(),
      _wts: +new Date()
   }))
  .put('#doc:1/15518843922520000000000000002', JSON.stringify({
      _rts: +new Date(),
      _wts: +new Date()
   }))
  .put('#doc:1/15518843922520000000000000003', JSON.stringify({
      _rts: +new Date(),
      _wts: +new Date()
   }))
  .write()
  .then(() => {
    const t1 = db.transaction((t) => {
      console.log(t.tid);   
      t.get('#doc1')
        .then((data) => {
          t.put('#doc:1', 'doc1')
            .put('#doc:1', 'doc1')
            .put('#doc:1', 'doc1')
            .put('#doc:1', 'doc1')
        });
    });
  });
*/
/*
(async () => await db.ttlReplay())();

Promise.all([
  db.ttlPut('ttl1', 10000),
  db.ttlPut('ttl2', 10000),
  db.ttlPut('ttl3', 10000),
]).then(process.exit);
*/
/*
db.batch()
  .put('key:1', 'value:1')
  .put('key:2', 'value:2')
  .put('key:3', 'value:3')
  .put('key:4', 'value:4')
  .put('key:5', 'value:5')
  .put('key:6', 'value:6')
  .put('key:7', 'value:7')
  .put('key:8', 'value:8')
  .write()
  .then(async () => {
    let fn = (k, v, emit) => { 
      return Promise.resolve(emit(k, v));
    };
    await db.putView('2', 'key:2', 'key:~', fn);
    await db.delView('2');
  });
/*
db.loadViews()
  .then(() => db.trigger('key:1', 'value:1'))
  .then(() => {
    console.log(db.views);
    console.log(db.views[0].fn.toString());
    db.views[0].fn();
  });
Promise.all([
  db.putView('1', 'key:1', 'key:~', (k, v, emit) => console.log(999)),
  db.putView('2', 'key:2', 'key:~', (k, v, emit) => emit(k, v)),
  db.putView('3', 'key:3', 'key:~', (k, v, emit) => emit(k, v)),
  db.putView('4', 'key:4', 'key:~', (k, v, emit) => emit(k, v)),
])
.then(() => console.log(db.views))
.then(() => db.views[0].fn());
*/
