var toDuplex = require('stream-to-pull-stream').duplex
var net = require('net')
var fs = require('fs')
var path = require('path')
var debug = require('debug')('multiserver:unix')

// hax on double transform
var started = false

module.exports = function (opts) {
  const socket = path.join(opts.path || '', 'socket')
  const addr = 'unix:' + socket
  let scope = opts.scope || 'device'
  opts = opts || {}
  return {
    name: 'unix',
    scope: function() { return scope },
    server: function (onConnection, cb) {
      if (started) return

      if (scope !== "device") {
        debug('Insecure scope for unix socket! Reverting to device scope')
        scope = 'device'
      }

      debug('listening on socket %s', addr)

      var server = net.createServer(opts, function (stream) {
        stream = toDuplex(stream)
        stream.address = addr
        onConnection(stream)
      }).listen(socket, cb)

      server.on('error', function (e) {
        if (e.code == 'EADDRINUSE') {
          var clientSocket = new net.Socket()
          clientSocket.on('error', function(e) {
            if (e.code == 'ECONNREFUSED') {
              fs.unlinkSync(socket)
              server.listen(socket)
            }
          })

          clientSocket.connect({ path: socket }, function() {
            debug('someone else is listening on socket!')
          })
        }
      })

      if (process.platform !== 'win32') {
        fs.chmodSync(socket, 0600)
      }

      started = true

      return function () {
        server.close()
      }
    },
    client: function (opts, cb) {
      debug('unix socket client')
      var started = false
      var stream = net.connect(opts.path)
        .on('connect', function () {
          if(started) return
          started = true

          var _stream = toDuplex(stream)
          _stream.address = addr
          cb(null, _stream)
        })
        .on('error', function (err) {
          debug('err? %o', err)
          if(started) return
          started = true
          cb(err)
        })

      return function () {
        started = true
        stream.destroy()
        cb(new Error('multiserver.unix: aborted'))
      }
    },
    //MUST be unix:socket_path
    parse: function (s) {
      var ary = s.split(':')
      if(ary.length < 2) return null
      if('unix' !== ary.shift()) return null
      return {
        name: '',
        path: ary.shift()
      }
    },
    stringify: function (_scope) {
      if(scope !== _scope) return null
      return ['unix', socket].join(':')
    }
  }
}
