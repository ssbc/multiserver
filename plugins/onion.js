const socks = require('socks').SocksClient
const toPull = require('stream-to-pull-stream')
const debug = require('debug')('multiserver:onion')

module.exports = function (opts) {
  if (!socks) {
    //we are in browser
    debug('onion dialing through socks proxy not supported in browser setting')
    return {
      name: 'onion',
      scope: function () {
        return 'public'
      },
      parse: function (s) {
        return null
      },
    }
  }

  opts = opts || {}
  const daemonProxyOpts = {
    ipaddress: '127.0.0.1',
    port: 9050,
    type: 5,
  }
  const browserProxyOpts = {
    ipaddress: '127.0.0.1',
    port: 9150,
    type: 5,
  }

  return {
    name: 'onion',
    scope: function () {
      return opts.scope || 'public'
    },
    server: function (onConnection, cb) {
      cb(new Error('Use net plugin for onion server instead'))
    },
    client: function (opts, cb) {
      let _socket, destroy

      function tryConnect(connectOpts, onFail) {
        socks.createConnection(connectOpts, function (err, result) {
          if (err) return onFail(err)

          const socket = result.socket

          if (destroy) return socket.destroy()
          _socket = socket

          const duplexStream = toPull.duplex(socket)
          duplexStream.address =
            'onion:' +
            connectOpts.destination.host +
            ':' +
            connectOpts.destination.port

          cb(null, duplexStream)

          // Remember to resume the socket stream.
          socket.resume()
        })
      }

      function connectOpts(proxyOpts) {
        return {
          proxy: proxyOpts,
          command: 'connect',
          destination: {
            host: opts.host,
            port: opts.port,
          },
        }
      }

      tryConnect(connectOpts(daemonProxyOpts), function (err) {
        tryConnect(connectOpts(browserProxyOpts), function (err) {
          cb(err)
        })
      })

      return function () {
        if (_socket) _socket.destroy()
        else destroy = true
      }
    },
    //MUST be onion:<host>:<port>
    parse: function (s) {
      const ary = s.split(':')
      if (ary.length < 3) return null
      if ('onion' !== ary.shift()) return null
      const port = +ary.pop()
      if (isNaN(port)) return null
      return {
        name: 'onion',
        host: ary.join(':') || 'localhost',
        port: port,
      }
    },
    stringify: function (scope) {
      return null
    },
  }
}
