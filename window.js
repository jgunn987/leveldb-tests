module.exports = (db) => {
  db.lastWindowId = 0;
  db.bookWindow = async (channel, start, end, data) =>
    new Promise((resolve, reject) =>
      db.createReadStream({ 
        gte: '$window:' + channel + ':' + start,
        lt: '$window:' + channel + ':' + end
      }).on('error', reject)
        .on('end', () => {
          db.lastWindowId += 1;
          db.batch()
            .put('$window:' + channel + ':' + db.lastWindowId, { channel, start, end, data })
            .put('$window:' + channel + ':' + start, db.lastWindowId)
            .put('$window:' + channel + ':' + end, db.lastWindowId)
            .write().then(resolve)
            .catch(reject);
        })
        .on('data', (data) => {
          throw new Error('window booked');
        }));

  db.unbookWindow = async(channel, id) => {
    const data = await db.get('$window:' + channel + ':' + id);
    if (!data) throw new Error('undefined window');
    return db.batch()
      .del('$window:' + channel + ';' + id)
      .del('$window:' + channel + ';' + data.start)
      .del('$window:' + channel + ';' + data.end)
      .write();
  }; 

  return db;
};
