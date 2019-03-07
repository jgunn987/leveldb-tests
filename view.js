const vm = require('vm');
const esprima = require('esprima');
const _ = require('lodash');

function compareFunctions(a, b) {
  const ap = esprima.parse(a);
  const bp = esprima.parse(b);
  return _.isEqual(ap, bp);
}

function compileFn(db, fn) {
  return new vm.Script(fn)
    .runInContext(db.viewContext);
}

function promisifiedStream(db, start, end, onData) {
  return new Promise((resolve, reject) =>
    db.createReadStream({ gte: start, lt: end })
      .on('error', reject)
      .on('end', resolve)
      .on('data', onData));
}

module.exports = (db) => {
  db.views = [];
  db.viewContext = vm.createContext({ db, console });
  db.loadViews = async () => 
    promisifiedStream(db, '$view:', '$view:~', (data) => {
      const id = data.key.replace('$view:', '');
      const value = JSON.parse(data.value);
      db.loadView(id, value.start, value.end, value.fn);
    });

  db.loadView = (id, start, end, fn) => {
    db.views = db.views.filter((v) => v.id !== id);
    const view = { id, start, end, fn: compileFn(db, fn) };
    db.views.push(view);
    return view;
  };

  db.putView = async (id, start, end, fn) => {
    fn = fn.toString();
    const view = db.views.find((v) => v.id === id);
    if (view && compareFunctions(view.fn.toString(), fn)) return this;
    await db.put('$view:' + id, JSON.stringify({ start, end, fn }));
    const newView = db.loadView(id, start, end, fn);
    await db.viewRunDel(newView);
    await db.viewFirstRun(newView);
    return this;
  };

  db.delView = async (id) => {
    const view = db.views.find((v) => v.id === id);
    db.views = db.views.filter((v) => v.id !== id);
    await db.del('$view:' + id);
    await db.viewRunDel(view);
    return this;
  };

  db.viewRunDel = (view) =>
    promisifiedStream(db, view.start, view.end, (data) =>
      view.fn(data.key, data.value, (k, v) =>
        console.log('deleting ' + k)));

  db.viewFirstRun = async (view) => 
    promisifiedStream(db, view.start, view.end, (data) =>
      view.fn(data.key, data.value, (k, v) =>
        console.log('comitting ' + k)));

  db.trigger = (key, value) =>
    db.views.filter((view) => (key >= view.start && key <= view.end))
      .map((view) => view.fn(key, value, (k, v) => 
        console.log('comitting ' + k)));

  return db;
};
