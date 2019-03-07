function tid(n) {
  return +new Date() + ("0000000000000000")
    .substr((16 + n.toString().length) - 16) + n;
}

class Transaction {
  constructor(db, tid) {
    this.db = db;
    this.tid = tid;
    this.ops = [];
  }

  async get(key) {
    return new Promise((resolve, reject) => {
      let found = null;
      const stream = this.db.createReadStream({
        gte: '#doc:'+ key + '/' + this.tid.slice(0, 13)
      }).on('error', reject)
        .on('close', () => found ? 
          resolve(found): 
          reject(new Error('key not found')))
        .on('data', (data) => {
          found = data.value;
          stream.destroy();
        });
    });
  }
  
  put(key, value) {
   this.ops.push({ type: 'put', key, value });
   return this;
  }
  
  del(key) {
    this.ops.push({ type: 'del', key });
    return this;
  }

  commit() {
    return this.db.batch(this.ops).write();
  }
}

module.exports = (db) => {
  db.lastTid = 0;
  db.getTid = () => 
    tid(db.lastTid += 1);
  db.getTidTimestamp = (tid) => 
    tid.slice(0, 13);
  db.getTidCount = (tid) => 
    tid.slice(13);
  db.transaction = (t) => 
    t(new Transaction(db, db.getTid()));
  return db;
};
