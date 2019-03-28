const { Writable, Transform } = require('stream');
const level = require('level');
const db = level('/tmp/another-one-db');

function mergeStreams(...input) {
  const transform = new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      this.push(chunk.value.toString());
      callback();
    }
  });

  let outstanding = input.length - 1;
  input.map((stream) => {
    stream.pipe(transform, { end: false });
    stream.on('end', () =>
      --outstanding <= 0 ? transform.end() : null);
  });

  if(!input.length) transform.end();

  return transform;
}

db.batch()
  .put('key1', 'value1')
  .put('key2', 'value2')
  .put('key3', 'value3')
  .put('key4', 'value4')
  .put('key5', 'value5')
  .put('key6', 'value6')
  .put('key7', 'value7')
  .put('key8', 'value8')
  .put('key9', 'value9')
  .write().then(() => {
      
    const read1 = db.createReadStream({ gte: 'key1', lte: 'key1' });
    const read2 = db.createReadStream({ gte: 'key2', lte: 'key2' });
    const read3 = db.createReadStream({ gte: 'key3', lte: 'key3' });
    const read4 = db.createReadStream({ gte: 'key4', lte: 'key4' });

    //const transform = mergeStreams(read1, read2, read3, read4);
    const transform = mergeStreams();
    transform.on('data', console.log);
    transform.on('end', () => console.log('end'));
  });
