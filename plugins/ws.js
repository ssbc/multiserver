var WS = require('pull-ws')
var URL = require('url')

module.exports = function (opts) {

  return {
    name: 'ws',
    server: function (onConnect) {
      var server = WS.createServer(opts, function (stream) {
        onConnect(stream)
      })

      if(!opts.server) server.listen(opts.port)
      return server.close.bind(server)
    },
    client: function (addr, cb) {
      if(!addr.host) {
        addr.hostname = addr.hostname || opts.host || 'localhost'
        addr.slashes = true
        addr = URL.format(addr)
      }

      var stream = WS.connect(addr, {onConnect: function (err) {
        cb(err, stream)
      }})
    },
    stringify: function () {
      return URL.format({
        protocol: 'ws',
        slashes: true,
        hostname: opts.host || 'localhost', //detect ip address
        port: opts.port
      })
    },
    parse: function (str) {
      var addr = URL.parse(str)
      if(!/^wss?\:$/.test(addr.protocol)) return null
      return addr
    }
  }
}










