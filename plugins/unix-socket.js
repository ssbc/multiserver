var toDuplex = require('stream-to-pull-stream').duplex
var net = require('net')
var fs = require('fs')
var path = require('path')

// hax on double transform
var started = false

module.exports = function (opts) {
  const socket = path.join(opts.path || '', 'socket')
  const addr = 'unix:' + socket
  const scope = opts.scope || 'device'
  opts = opts || {}
  return {
    name: 'unix',
    scope: function() { return scope },
    server: !opts.server ? null : function (onConnection) {
      if(started) return
      console.log("listening on socket", addr)

      var server = net.createServer(opts, function (stream) {
        stream = toDuplex(stream)
        stream.address = addr
        onConnection(stream)
      }).listen(socket)

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
            console.log("someone else is listening on socket!")
          })
        }
      })

      fs.chmodSync(socket, 0600)

      started = true

      return function () {
        server.close()
      }
    },
    client: function (opts, cb) {
      console.log("unix socket client")
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
          console.log("err?", err)
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
      if(opts && !opts.server) return null
      return ['unix', socket].join(':')
    }
  }
}

