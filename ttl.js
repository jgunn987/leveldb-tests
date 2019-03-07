async function delTTLEntry(db, k) {
  return db.batch().del(k)
    .del('$ttl:' + k)
    .write();
}

function setTTLTimer(db, k, ttl) {
  return db.ttlLog[k] = setTimeout(() => {
    delTTLEntry(db, k);
  }, Number(ttl));
}

module.exports = (db) => {
  db.ttlLog = {};
  db.ttlReplay = async () =>
    new Promise((resolve, reject) =>
      db.createReadStream({ gte: '$ttl:', lt: '$ttl:~' })
        .on('error', reject)
        .on('end', resolve)
        .on('data', (data) => { 
          const k = data.key.replace('$ttl:', '');
          const now = +new Date();
          const ttl = Number(data.value);
          return now < ttl ?
            setTTLTimer(db, k, ttl - now):
            delTTLEntry(db, k);
        }));

  db.ttlPut = async (k, ttl) => {
    const timestamp = +new Date() + Number(ttl);
    setTTLTimer(db, k, ttl);
    return await db.put('$ttl:' + k, timestamp);
  };

  db.ttlDel = async (k) => {
    const tid = db.ttlLog[k];
    if (tid) clearTimeout(tid);
    return await db.del('$ttl:' + k);
  };

  return db;
};
