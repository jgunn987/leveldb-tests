const net = require('net');
const JSONStream = require('JSONStream');

function handleUpdate(db, message) {
  const batch = db.batch()
  if (message.value.type === 'put') {
    batch.put(message.key, JSON.stringify(message.value))
    batch.put(message.value.key, message.value.value)
  } else if (message.value.type === 'del') {
    batch.put(message.key, JSON.stringify(message.value))
    batch.del(message.value.key);
  }
  return batch.write();
}

class Client extends net.Socket {
  constructor(db, options) {
    super(options);
    this.db = db;
  }

  connect(options) {
    return super.connect(options, () => {
      this.write(JSON.stringify({ type: 'sync', from: '#log:key2' }));
      this.pipe(JSONStream.parse())
        .on('data', (message) => {
          if(message.type === 'log') {
            console.log('updating ' + message.key);
            handleUpdate(this.db, message);
          }    
        });
    }); 
  }

  handleMessage(message) {
  
  }
}

module.exports = function (db, options) {
  return new Client(db, options);
};
