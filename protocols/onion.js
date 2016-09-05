var net = require('net')
var proxy = require('tproxy')
var toPull = require('stream-to-pull-stream')

module.exports = function () {
  return {
    protocol: 'onion',
    createServer: function (host, onConnection) {
      var server = net.createServer({allowHalfOpen: true},
      function (stream) {
        stream.allowHalfDuplex = true
        stream = proxy(stream, { port: 9050 }) // tor default
        onConnection(toPull.duplex(stream))
      }).listen(host)
      return function (cb) {
        server.close(cb)
      }
    },
    connect: function (address, cb) {
      var started = false
      var _stream = net.connect(address)
      _stream = proxy(_stream, { port: 9050 })
        .on('connect', function () {
          if(started) return
          started = true
          cb(null, stream)
        })
        .on('error', function (err) {
          if(started) return
          started = true
          cb(err)
        })
      _stream.allowHalfDuplex = true
      var stream = toPull.duplex(_stream)
    }
  }
}
