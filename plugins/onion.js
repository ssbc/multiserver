var socks = require('socks');
var toPull = require('stream-to-pull-stream')

module.exports = function (opts) {
  if(!socks) return //we are in browser

  opts = opts || {}
  var proxyOpts = {
      ipaddress: "localhost",
      //TODO: tor port should be configurable.
      port: 9050, // default tor port
      type: 5
  }
  return {
    name: 'onion',
    server: function (onConnection) {
          if(!opts.server) return

          var serverOpts = {
              proxy: proxyOpts,
              command: "bind",
              target: {
                  host: opts.host,
                  port: opts.port
              }
          }
          var controlSocket = null
          socks.createConnection(serverOpts, function (err, socket) {
              if(err) {
                console.error('unable to find local tor server.')
                console.error('will be able receive tor connections')
                return
              }
              controlSocket = socket

              socket.on('data', function(stream) {
                  stream = toPull.duplex(stream)
                  stream.address = 'onion:'
                  onConnection(stream)
              })

              // Remember to resume the socket stream.
              socket.resume()
          })
          return function () {
              if (controlSocket != null)
                  controlSocket.end()
          }
    },
    client: function (opts, cb) {
        var started = false, _socket, destroy

        var connectOpts = {
            proxy: proxyOpts,
            command: "connect",
            target: {
                host: opts.host,
                port: opts.port
            }
        }

        socks.createConnection(connectOpts, function(err, socket) {
            if (err) return cb(err)

            if(destroy) return socket.destroy()
            _socket = socket

            var duplexStream = toPull.duplex(socket)
            duplexStream.address = 'onion:'+connectOpts.target.host+':'+connectOpts.target.port

            cb(null, duplexStream)

            // Remember to resume the socket stream.
            socket.resume()
        })
        return function () {
          if(_socket) _socket.destroy()
          else destroy = true
        }
    },
    //MUST be onion:<host>:<port>
    parse: function (s) {
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
      if(opts && !opts.server) return
      return ['onion', opts.host, opts.port].join(':')
    }
  }
}

