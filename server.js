const net = require('net');
const JSONStream = require('JSONStream');

class Server extends net.Server {
  constructor(db, options) {
    super(options, (socket) => {
      this.sockets.push(socket);
      socket.on('error', (err) => console.log(err));
      socket.on('end', () => {
        this.sockets = this.sockets.filter((s) => s !== socket);
      });
      socket.pipe(JSONStream.parse())
        .on('data', (message) => {
          this.handleMessage(socket, message);
        });
    });

    this.db = db;
    this.sockets = [];
  }

  handleMessage(socket, message) {
    switch(message.type) {
      case 'sync':
        this.serveLog(socket, message.from);
        break;
    }
  }

  serveLog(socket, from) {
    return this.db.createReadStream({ gt: from })
      .on('data', (data) => {
        socket.write(JSON.stringify({
          type: 'log',
          key: data.key, 
          value: JSON.parse(data.value)
        }));
      });
  }

  broadcast(message) {
    this.sockets.forEach((socket) =>
      socket.write(message));
    return this;
  }
}

module.exports = function (options) {
  return new Server(options);
};
