var net
try {
  net = require('net')
} catch (_) {
  // This only throws in browsers because they don't have access to the Node
  // net library, which is safe to ignore because they should only be running
  // `parse()` and `stringify()`.
}

var toPull = require('stream-to-pull-stream')
var scopes = require('multiserver-scopes')
var debug = require('debug')('multiserver:net')

const isString = (s) => 'string' == typeof s
const toAddress = (host, port) => ['net', host, port ].join(':')

function toDuplex (str) {
  var stream = toPull.duplex(str)
  stream.address = toAddress(str.remoteAddress, str.remotePort)
  return stream
}

// Choose a dynamic port between 49152 and 65535
// https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers#Dynamic,_private_or_ephemeral_ports
const getRandomPort = () =>
  Math.floor(49152 + (65535 - 49152 + 1) * Math.random())

module.exports = ({ scope, host, port, external, allowHalfOpen, pauseOnConnect }) => {
  // Arguments are `scope` and `external` plus selected options for
  // `net.createServer()` and `server.listen()`.
  scope = scope || 'device'
  port = port || getRandomPort()
  host = host || (isString(scope) && scopes.host(scope))

  function isAllowedScope (s) {
    return s === scope || Array.isArray(scope) && scope.includes(s)
  }

  return {
    name: 'net',
    scope: () => scope,
    server: function (onConnection, startedCb) {
      debug('Listening on %s:%d', host, port)

      // TODO: We convert `allowHalfOpen` to boolean for legacy reasons, this
      // should be removed when multiserver undergoes a major version change.
      const serverOpts = {
        allowHalfOpen: !!allowHalfOpen,
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
    stringify: function (targetScope) {
      targetScope = scope || 'device'

      if (isAllowedScope(targetScope) === false) {
        return null
      }

      // We want to avoid using `host` if the target scope is public and some
      // external host (like example.com) is defined.
      const externalHost = targetScope === 'public' && external
      const resultHost = externalHost || host

      if (resultHost == null) {
        // This should only happen if `host == null && publicHost == null`,
        // which may not even be possible (?). This may be a candidate for
        // removal in the future.
        return null
      }

      return toAddress(resultHost, port)
    }
  }
}

