const db = require('level')('/tmp/test-db');

db.batch()
  .put('%User/$i/name:Jameson1:434f358e-b434-41e7-af4f-a6a8c546464a', 'v1')
  .put('%User/$i/name:Jameson2:', 'v1')
  .write().then(() =>
      //db.createReadStream({
      //  gte: '%User/$i/name:Jameson1:434f358e-b434-41e7-af4f-a6a8c546464a',
      //  lte: '%User/$i/name:Jameson1:434f358e-b434-41e7-af4f-a6a8c546464a'
      //}).on('data', console.log)
      db.createReadStream({
gte: '%User/$i/name:Jameson2:',
        lte: '%User/$i/name:Jameson~'
      }).on('data', console.log)

);

