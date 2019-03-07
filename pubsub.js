
module.exports = (db) => {
  db.watch = (start, end, callback) =>
    db.on('put', (data) =>
      if(data.key >= start && data.key <= end)
        callback(data.key, data.value);

  return db;
};
