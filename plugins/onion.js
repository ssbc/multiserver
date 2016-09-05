var net
try {
  net = require('net')
} catch (_) {}

var proxy = require('tproxy')
var toPull = require('stream-to-pull-stream')

module.exports = function (opts) {
  opts.allowHalfOpen = opts.allowHalfOpen !== false
  return {
    name: 'onion',
    server: function (onConnection) {
      var server = net.createServer(opts, function (stream) {
        var proxyStream = proxy(stream, { port: 9050 }) // tor default
        onConnection(proxyStream = toPull.duplex(proxyStream))
      }).listen(opts)
      return function () {
        server.close()
      }
    },
    client: function (opts, cb) {
      var started = false
      var stream = net.connect(opts)
      stream = proxy(stream, { port: 9050 }) // tor default
        .on('connect', function () {
          if(started) return
          started = true
          cb(null, toPull.duplex(stream))
        })
        .on('error', function (err) {
          if(started) return
          started = true
          cb(err)
        })
    },
    //MUST be onion:<host>:<port>
    parse: function (s) {
      if(!net) return null
      var ary = s.split(':')
      if(ary.length < 3) return null
      if('onion' !== ary.shift()) return null
      var port = +ary.pop()
      if(isNaN(port)) return null
      return {
        name: 'onion',
        host: ary.join(':') || 'localhost',
        port: port
      }
    },
    stringify: function () {
      return ['onion', opts.host || 'localhost', opts.port].join(':')
    }
  }
}
