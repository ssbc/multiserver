var socks = require('socks');
var toPull = require('stream-to-pull-stream')

var options = {
    proxy: {
        ipaddress: "localhost",
        port: 9050, // default tor port
        type: 5
    },
}

module.exports = function (opts) {
  return {
    name: 'onion',
      server: function (onConnection) {
          var serverOpts = {
              proxy: options.proxy,
              command: "bind",
              target: {
                  host: opts.host,
                  port: opts.port
              }
          }
          var controlSocket = null
          socks.createConnection(serverOpts, function (err, socket) {
              controlSocket = socket

              socket.on('data', function(data) {
                  onConnection(data = toPull.duplex(data))
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
        var started = false

        var connectOpts = {
            proxy: {
                ipaddress: "localhost",
                port: 9050, // default tor port
                type: 5
            },
            command: "connect",
            target: {
                host: opts.host,
                port: opts.port
            }
        }

        socks.createConnection(connectOpts, function(err, socket) {
            if (err) return

            cb(null, toPull.duplex(socket))

            socket.on('error', function (err) {
                cb(err)
            })

            // Remember to resume the socket stream.
            socket.resume()
        })
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
      return ['onion', opts.host || 'localhost', opts.port].join(':')
    }
  }
}
