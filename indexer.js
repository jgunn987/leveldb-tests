
function indexDocument(schema, p, c) {
  return Object.keys(schema.fields).map((name) =>
    schema.fields[name].$index === true ?
      index(schema, name, p, c) : []);
}

function drop(schema, field) {
  // scan all 'doc:k=v' and delete
}

function create(schema, field) {
 // scan all doc and call indexField
}

function index(schema, field, p, c) {
  const options = schema.fields[field];
  if(!p[field] && c[field]) {
    return [['put', field + '=' + c[field]]];
  } else if(p[field] && !c[field]) {
    return [['del', field + '=' + p[field]]];
  } else if (p[field] !== c[field]) {
    return [['del', field + '=' + p[field]],
            ['put', field + '=' + c[field]]];
  } else {
    return [];
  }
}

const schema = {
  table: 'Entity',
  fields: {
    name: { $index: true },
    age: { $index: true },
  }
};
const a = { name: 'Jim', age: 23 };
const b = { name: 'James', age: 22 };

console.log(indexDocument(schema, a, b));
