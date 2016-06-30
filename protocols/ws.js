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
        if(!addr.host)
          addr.hostname = addr.hostname || 'localhost'
        addr.slashes = true
        addr = URL.format(addr)
      }
      var stream = WS.connect(addr, {onConnect: function (err) {
        cb(err, stream)
      }})
    }
  }
}






