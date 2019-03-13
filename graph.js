const level = require('level');
const levelgraph = require('levelgraph');
const db = levelgraph(xdb = level('/tmp/graph-db'));

var triple = { subject: "z", predicate: "b", object: "c", "someStuff": 42 };
db.put(triple, function() {
  db.get({ subject: "a" }, function(err, list) {
    console.log(list);
    xdb.createKeyStream().on('data', console.log);
    xdb.createReadStream().on('data', console.log);
    console.log(Object.keys(xdb.db.db));
    /* reads
      ops::o::p::s:{subject.uuid} => {object.uuid}
      osp::o::s::p:{subject.uuid} => {object.uuid}
      pos::p::o::s:{subject.uuid} => {object.uuid}
      pso::p::s::o:{subject.uuid} => {object.uuid}
      sop::s::o::p:{subject.uuid} => {object.uuid}
      spo::s::p::o:{subject.uuid} => {object.uuid}
    */
  });
});
