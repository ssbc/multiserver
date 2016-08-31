var net
try {
  net = require('net')
} catch (_) {}

var toPull = require('stream-to-pull-stream')

module.exports = function (opts) {
  opts.allowHalfOpen = opts.allowHalfOpen !== false
  return {
    name: 'net',
    server: function (onConnection) {
      var server = net.createServer(opts, function (stream) {
        onConnection(stream = toPull.duplex(stream))
      }).listen(opts)
      return function () {
        server.close()
      }
    },
    client: function (opts, cb) {
      var started = false
      var stream = net.connect(opts)
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
    //MUST be net:<host>:<port>
    parse: function (s) {
      if(!net) return null
      var ary = s.split(':')
      if(ary.length < 3) return null
      if('net' !== ary.shift()) return null
      var port = +ary.pop()
      if(isNaN(port)) return null
      return {
        name: 'net',
        host: ary.join(':') || 'localhost',
        port: port
      }
    },
    stringify: function () {
      return ['net', opts.host || 'localhost', opts.port].join(':')
    }
  }
}

