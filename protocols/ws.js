var WS = require('pull-ws')
var URL = require('url')
module.exports = function () {
  return {
    protocol: 'ws',
    createServer: function (opts, onConnect) {
      console.log('create WS server', opts)
      var server = WS.createServer(opts, function (stream) {
        onConnect(stream)
      }).listen(opts.port)
      return server.close.bind(server)
    },
    connect: function (addr, cb) {
      if('object' == typeof addr) {
        addr.host = addr.host || 'localhost'
        addr = URL.format(addr)
      }
      return WS.connect(addr, {onConnect: cb})
    }
  }
}

