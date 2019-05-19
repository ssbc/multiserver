const toPull = require('stream-to-pull-stream')
const debug = require('debug')('multiserver:net')
const {
  getAddress,
  getRandomPort,
  protocolToAddress
} = require('../lib/util.js')

var net
try {
  net = require('net')
} catch (_) {
  // Uncaught because this should work in a browser.
}

const toAddress = protocolToAddress('net')

function toDuplex (str) {
  var stream = toPull.duplex(str)
  stream.address = toAddress(str.remoteAddress, str.remotePort)
  return stream
}

module.exports = ({ scope = 'device', host, port, external, allowHalfOpen, pauseOnConnect }) => {
  // Arguments are `scope` and `external` plus selected options for
  // `net.createServer()` and `server.listen()`.
  host = getAddress(host, scope)
  port = port || getRandomPort()

  function isAllowedScope (s) {
    return s === scope || Array.isArray(scope) && scope.includes(s)
  }

  return {
    name: 'net',
    scope: () => scope,
    server: function (onConnection, startedCb) {
      debug('Listening on %s:%d', host, port)

      // TODO: We convert `allowHalfOpen` to boolean for legacy reasons, this
      // might not be getting used anywhere but I'm too scared to change it.
      // This should probably be removed when we do a major version bump.
      const serverOpts = {
        allowHalfOpen: Boolean(allowHalfOpen),
        pauseOnConnect
      }

      var server = net.createServer(serverOpts, function (stream) {
        onConnection(toDuplex(stream))
      }).listen(port, host, startedCb)
      return function (cb) {
        debug('Closing server on %s:%d', host, port)
        server.close(function(err) {
          if (err) console.error(err)
          else debug('No longer listening on %s:%d', host, port)
          if (cb) cb(err)
        })
      }
    },
    client: function (opts, cb) {
      var started = false
      var stream = net.connect(opts)
        .on('connect', function () {
          if(started) return
          started = true

          cb(null, toDuplex(stream))
        })
        .on('error', function (err) {
          if(started) return
          started = true
          cb(err)
        })

      return function () {
        started = true
        stream.destroy()
        cb(new Error('multiserver.net: aborted'))
      }
    },
    //MUST be net:<host>:<port>
    parse: function (s) {
      if (net == null) return null
      var ary = s.split(':')
      if(ary.length < 3) return null
      if('net' !== ary.shift()) return null
      var port = Number(ary.pop())
      if(isNaN(port)) return null
      return {
        name: 'net',
        host: ary.join(':') || 'localhost',
        port: port
      }
    },
    stringify: function (targetScope = 'device') {
      if (isAllowedScope(targetScope) === false) {
        return null
      }

      // We want to avoid using `host` if the target scope is public and some
      // external host (like example.com) is defined.
      const externalHost = targetScope === 'public' && external
      const resultHost = externalHost || getAddress(host, targetScope)

      // console.log({ resultHost })

      if (resultHost == null) {
        // The device has no network interface for a given `targetScope`.
        return null
      }

      if (Array.isArray(resultHost)) {
        return resultHost.map(addr => toAddress(addr, port)).join(';')
      } else {
        return toAddress(resultHost, port)
      }
    }
  }
}

