var toPull = require('stream-to-pull-stream')
var net = require('net')
var fs = require('fs')
var path = require('path')

// hax on double transform
var started = false

module.exports = function (opts) {
  const socket = path.join(opts.path || '', 'socket')
  const addr = 'unix:' + socket
  
  opts = opts || {}
  return {
    name: 'unix',
    scope: function() { return opts.scope },
    server: function (onConnection) {
      if(started) return
      console.log("listening on socket", addr)

      var server = net.createServer(opts, function (stream) {
        onConnection(toPull.duplex(stream))
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
      var stream = net.connect(opts)
        .on('connect', function () {
          if(started) return
          started = true

          cb(null, toPull.duplex(stream))
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
    stringify: function () {
      if(opts && !opts.server) return
      return ['local', opts.path].join(':')
    }
  }
}

