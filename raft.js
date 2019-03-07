const uuid = require('uuid');
const EventEmitter = require('events');

class Node extends EventEmitter {
  constructor({ id, term }) {
    super();
    this.id = id || uuid.v4();
    this.term = term;
    this.hasVoted = false;
    this.leader = null;
    this.log = [];
    this.peers = {};
    this.votes = 0;
  }

  start() {
    this.makeFollower();
    return this;
  }

  addPeer(peer) {
    this.peers[peer.id] = peer;
    return this;
  }

  makeFollower() {
    this.electionTimeout();
    this.emit(this.state = 'follower');
    return this;
  }

  getVote(peerId, term) {
    if(!this.hasVoted) {
      if(this.electionTimer) clearTimeout(this.electionTimer);
      return 1;
    } else {
      return 0;
    }
  }

  makeCandidate() {
    this.term += 1;
    this.votes += 1;
    this.emit(this.state = 'candidate');
    return this;
  }

  requestVotes() {
    this.votes = this.peers.map((peer) => peer.getVote())
      .reduce((p, c) => p + c, this.votes);
    return this;
  }

  makeLeader() {
    this.emit(this.state = 'leader');
    return this;
  }

  appendEntries() {
    if(this.electionTimer) clearTimeout(this.electionTimer);
    return this;
  }

  electionTimeout() {
    return this.electionTimer =
      setTimeout(() => this.makeCandidate(),
        Math.floor(Math.random() * 
          (300 - 150 + 1)) + 150);
  }

  heartbeat() {
    return this.heartbeatInterval =
      setInterval(() => {}, 200);
  }
}

const node1 = new Node({ term: 0 });
const node2 = new Node({ term: 0 });
const node3 = new Node({ term: 0 });
const node4 = new Node({ term: 0 });
const node5 = new Node({ term: 0 });

node1.addPeer(node2)
  .addPeer(node3)
  .addPeer(node4)
  .addPeer(node5)
  .start()
node2.addPeer(node1)
  .addPeer(node3)
  .addPeer(node4)
  .addPeer(node5)
  .start()
node3.addPeer(node1)
  .addPeer(node2)
  .addPeer(node4)
  .addPeer(node5)
  .start()
node4.addPeer(node1)
  .addPeer(node2)
  .addPeer(node3)
  .addPeer(node5)
  .start()
node5.addPeer(node1)
  .addPeer(node2)
  .addPeer(node3)
  .addPeer(node4)
  .start()

/*
node1.on('candidate', () => 
  console.log('candidate:node1', node1.id));
node2.on('candidate', () => 
  console.log('candidate:node2', node2.id));
node3.on('candidate', () => 
  console.log('candidate:node3', node3.id));
node4.on('candidate', () => 
  console.log('candidate:node4', node4.id));
node5.on('candidate', () => 
  console.log('candidate:node5', node5.id));
*/

const level = require('level');
const db1 = level('/tmp/db1', {
  valueEncoding: 'utf8' });

function transactionId(i) {
  return (+new Date()).toString() + logId(i);
}

function logId(i) {
  let s = "0000000000000000" + i;
  return s.substr(s.length - 16);
}

db1.batch()
  .put('$:' + logId(1))
  .put('$:' + logId(9))
  .put('$:' + logId(10))
  .put('$:' + logId(11))
  .put('$:' + logId(12))
  .put('$:' + logId(13))
  .put('$:' + logId(20))
  .put('$:' + logId(21))
  .put('$:' + logId(22))
  .put('$:head', logId(22))
  .write().then(() => db1.createReadStream({ gte: '$:', lt: '$:head' })
    .on('data', (data) => console.log(data.key, Number(data.key.replace('$:', '')))));

let views = [];

function view(id, start, end, fn) {
  views = views.filter((v) => v.id !== id);
  return views.push({ id, start, end, fn });
}

function match(key, start, end) {
  return key >= start && key <= end;
}

function trigger(key, value) {
  views.filter((view) => match(key, view.start, view.end))
    .map((view) => view.fn(key, value, (k, v) => 
      console.log('comitting ' + k)));
}

view('view1', 'key2', 'key4', 
  (k, v, emit) => emit(k, v));
view('view2', 'key1', 'key10', 
  (k, v, emit) => emit(k, v));

trigger('key4', 'value4');
trigger('key10', 'value10');
trigger('key100', 'value100');

console.log(transactionId(9));
