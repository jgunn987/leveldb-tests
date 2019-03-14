function dropIndex(db, table, index) {
  return db.createReadStream({ 
    gte: '%' + table + '/$i/' + index,
    lt: '%' + table + '/$i/' + index + '~',
    values: false,
    keys: true
  }).on('close', () => {})
    .on('end', () => {})
    .on('data', (key) => db.del(key));
}

function createIndex(db, schema, index) {
  return db.createReadStream({ 
    gte: '%' + table + '/$latest',
    lt: '%' + table + '/$latest~',
    values: true,
    keys: true
  }).on('close', () => {})
    .on('end', () => {})
    .on('data', (data) => {
      //get indexer
      //run indexer directly
    });
}

function indexDocument(db, schema, p, c) {
  Object.keys(schema.indexes).map((index) => {
    //get indexer
    //run indexer directly
  });
}
// this function needs the previous and current documents schemas
// to accurately create and drop indexes
function index(db, schema, index, p, c) {
  if(!p[field] && c[field]) {
    return [['put', c[field]]];
  } else if(p[field] && !c[field]) {
    return [['del', p[field]]];
  } else if (p[field] !== c[field]) {
    return [['del', p[field]],
            ['put', c[field]]];
  } else {
    return [];
  }
}

