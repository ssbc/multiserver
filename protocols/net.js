var net = require('net')
var toPull = require('stream-to-pull-stream')

module.exports = function () {
  return {
    protocol: 'net',
    createServer: function (host, onConnection) {
      var server = net.createServer({allowHalfOpen: true},
      function (stream) {
        stream.allowHalfDuplex = true
        onConnection(toPull.duplex(stream))
      }).listen(host)
      return function (cb) {
        server.close(cb)
      }
    },
    connect: function (address, cb) {
      var started = false
      var _stream = net.connect(address)
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





