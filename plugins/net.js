const toPull = require('stream-to-pull-stream')
const scopes = require('multiserver-scopes')
const debug = require('debug')('multiserver:net')
let net
try {
  net = require('net')
} catch (_) {
  // This only throws in browsers because they don't have access to the Node net
  // library, which is safe to ignore because they shouldn't be running any
  // methods that require the net library. Maybe we should be setting a flag
  // somewhere rather than checking whether `net == null`?
}

const isString = (s) => 'string' == typeof s
const toAddress = (host, port) => ['net', host, port].join(':')

function toDuplex(str) {
  const stream = toPull.duplex(str)
  stream.address = toAddress(str.remoteAddress, str.remotePort)
  return stream
}

// Choose a dynamic port between 49152 and 65535
// https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers#Dynamic,_private_or_ephemeral_ports
const getRandomPort = () =>
  Math.floor(49152 + (65535 - 49152 + 1) * Math.random())

module.exports = function Net({
  scope = 'device',
  host,
  port,
  external,
  allowHalfOpen,
  pauseOnConnect,
}) {
  // Arguments are `scope` and `external` plus selected options for
  // `net.createServer()` and `server.listen()`.
  host = host || (isString(scope) && scopes.host(scope))
  port = port || getRandomPort()

  function isAllowedScope(s) {
    return s === scope || (Array.isArray(scope) && scope.includes(s))
  }

  return {
    name: 'net',
    scope: () => scope,
    server(onConnection, startedCB) {
      debug('Listening on %s:%d', host, port)
      let tempStartedCB = startedCB

      // TODO: We convert `allowHalfOpen` to boolean for legacy reasons, this
      // might not be getting used anywhere but I'm too scared to change it.
      // This should probably be removed when we do a major version bump.
      const serverOpts = {
        allowHalfOpen: Boolean(allowHalfOpen),
        pauseOnConnect,
      }

      const server = net.createServer(
        serverOpts,
        function connectionListener(stream) {
          onConnection(toDuplex(stream))
        }
      )

      server.addListener('error', function onError(err) {
        if (tempStartedCB) {
          tempStartedCB(err)
          tempStartedCB = null
        } else {
          console.error(err)
        }
      })

      server.listen(port, host, function onListening() {
        if (tempStartedCB) {
          tempStartedCB()
          tempStartedCB = null
        }
      })

      return function closeNetServer(cb) {
        debug('Closing server on %s:%d', host, port)
        server.close(function onNetServerClosing(err) {
          if (err) console.error(err)
          else debug('No longer listening on %s:%d', host, port)
          if (cb) cb(err)
        })
      }
    },

    client(opts, cb) {
      let started = false
      const stream = net
        .connect(opts)
        .on('connect', function onConnect() {
          if (started) return
          started = true
          cb(null, toDuplex(stream))
        })
        .on('error', function onError(err) {
          if (started) return
          started = true
          cb(err)
        })

      return function closeNetClient() {
        started = true
        stream.destroy()
        cb(new Error('multiserver.net: aborted'))
      }
    },

    // MUST be net:<host>:<port>
    parse(s) {
      if (net == null) return null
      const ary = s.split(':')
      if (ary.length < 3) return null
      if ('net' !== ary.shift()) return null
      const port = Number(ary.pop())
      if (isNaN(port)) return null
      return {
        name: 'net',
        host: ary.join(':') || 'localhost',
        port: port,
      }
    },

    stringify(targetScope = 'device') {
      if (isAllowedScope(targetScope) === false) {
        return null
      }

      // We want to avoid using `host` if the target scope is public and some
      // external host (like example.com) is defined.
      const externalHost = targetScope === 'public' && external
      let resultHost = externalHost || host || scopes.host(targetScope)

      if (resultHost == null) {
        // The device has no network interface for a given `targetScope`.
        return null
      }

      // convert to an array for easier formatting
      if (isString(resultHost)) {
        resultHost = [resultHost]
      }

      return resultHost
        .map((h) => {
          // Remove IPv6 scopeid suffix, if any, e.g. `%wlan0`
          return toAddress(h.replace(/(\%\w+)$/, ''), port)
        })
        .join(';')
    },
  }
}
