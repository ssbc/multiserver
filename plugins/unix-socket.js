var toPull = require('stream-to-pull-stream')
var net = require('net')
var fs = require('fs')
var path = require('path')

// hax on double transform
var started = false

module.exports = function (opts) {
  const config = require('ssb-config/inject')(process.env.ssb_appname)
  const socket = path.join(config.path, 'socket')
  const addr = 'local:' + socket
  
  function toDuplex (str) {
    var stream = toPull.duplex(str)
    stream.address = addr
    stream.remote = 'local'
    stream.auth = { allow: null, deny: null }
    return stream
  }

  opts = opts || {}
  return {
    name: 'local',
    scope: function() { return opts.scope },
    server: function (onConnection) {
      if(started) return
      console.log("listening on socket")

      var server = net.createServer(opts, function (stream) {
        onConnection(toDuplex(stream))
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
      console.log("local socket client")
      var started = false
      var stream = net.connect(opts)
        .on('connect', function () {
          if(started) return
          started = true

          cb(null, toDuplex(stream))
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
        cb(new Error('multiserver.local: aborted'))
      }
    },
    //MUST be local:socket_path
    parse: function (s) {
      var ary = s.split(':')
      if(ary.length < 2) return null
      if('local' !== ary.shift()) return null
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

