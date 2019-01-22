var net
try {
  net = require('net')
} catch (_) {}

function isString(s) {
  return 'string' == typeof s
}

var toPull = require('stream-to-pull-stream')
var scopes = require('multiserver-scopes')
var debug = require('debug')('multiserver:net')

function toDuplex (str) {
  var stream = toPull.duplex(str)
  stream.address = 'net:'+str.remoteAddress+':'+str.remotePort
  return stream
}

module.exports = function (opts) {
  // Choose a dynamic port between 49152 and 65535
  // https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers#Dynamic,_private_or_ephemeral_ports
  var port = opts.port || Math.floor(49152 + (65535 - 49152 + 1) * Math.random())
  //does this actually need to set host from the scope here?
  var host = opts.host || (isString(opts.scope) && scopes.host(opts.scope))
  var scope = opts.scope || 'device'
  // FIXME: does this even work anymore?
  opts.allowHalfOpen = opts.allowHalfOpen !== false

  function isScoped (s) {
    return s === scope || Array.isArray(scope) && ~scope.indexOf(s)
  }

  return {
    name: 'net',
    scope: function() {
      return scope
    },
    server: function (onConnection, startedCb) {
      debug('Listening on %s:%d', host, port)
      var server = net.createServer(opts, function (stream) {
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
      var addr = 'net:'+opts.host+':'+opts.port
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
    stringify: function (scope) {
      scope = scope || 'device'
      if(!isScoped(scope)) return
      var _host = (scope == 'public' && opts.external) || scopes.host(scope)
      if(!_host) return null
      return ['net', _host, port].join(':')
    }
  }
}

