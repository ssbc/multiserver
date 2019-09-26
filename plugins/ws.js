var WS = require('pull-ws')
var URL = require('url')
var pull = require('pull-stream/pull')
var Map = require('pull-stream/throughs/map')
var scopes = require('multiserver-scopes')
var http = require('http')
var https      = require('https')
var fs         = require('fs')
var debug = require('debug')('multiserver:ws')

function safe_origin (origin, address, port) {

  //if the connection is not localhost, we shouldn't trust
  //the origin header. So, use address instead of origin
  //if origin not set, then it's definitely not a browser.
  if(!(address === '::1' || address === '127.0.0.1') || origin == undefined)
    return 'ws:' + address + (port ? ':' + port : '')

  //note: origin "null" (as string) can happen a bunch of ways
  //      it can be a html opened as a file
  //      or certain types of CORS
  //      https://www.w3.org/TR/cors/#resource-sharing-check-0
  //      and webworkers if loaded from data-url?
  if(origin === 'null')
    return 'ws:null'

  //a connection from the browser on localhost,
  //we choose to trust this came from a browser.
  return origin.replace(/^http/, 'ws')

}

// Choose a dynamic port between 49152 and 65535
// https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers#Dynamic,_private_or_ephemeral_ports
const getRandomPort = () =>
  Math.floor(49152 + (65535 - 49152 + 1) * Math.random())

module.exports = function (opts = {}) {
  // This takes options for `WebSocket.Server()`:
  // https://github.com/websockets/ws/blob/master/doc/ws.md#new-websocketserveroptions-callback

  opts.binaryType = opts.binaryType || 'arraybuffer'
  const scope = opts.scope || 'device'

  function isAllowedScope (s) {
    return s === scope || Array.isArray(scope) && ~scope.indexOf(s)
  }

  var secure = opts.server && !!opts.server.key || (!!opts.key && !!opts.cert)
  return {
    name: 'ws',
    scope: () => scope,
    server: function (onConnect, startedCb) {
      if (WS.createServer == null) { 
        return null
      }

      // Maybe weird: this sets a random port each time that `server()` is run
      // whereas the net plugin sets the port when the outer function is run.
      //
      // This server has a random port generated at runtime rather than when
      // the interface is instantiated. Is that the way it should work?
      opts.port = opts.port || getRandomPort()

      if (typeof opts.key === 'string')
        opts.key = fs.readFileSync(opts.key)
      if (typeof opts.cert === 'string')
        opts.cert = fs.readFileSync(opts.cert)

      var server = opts.server ||
          (opts.key && opts.cert ? https.createServer({ key: opts.key, cert: opts.cert }, opts.handler) : http.createServer(opts.handler))

      WS.createServer(Object.assign({}, opts, {server: server}), function (stream) {
        stream.address = safe_origin(
          stream.headers.origin,
          stream.remoteAddress,
          stream.remotePort
        )
        onConnect(stream)
      })

      if(!opts.server) {
        debug('Listening on %s:%d', opts.host, opts.port)
        server.listen(opts.port, opts.host, function () {
          startedCb && startedCb(null, true)
        })
      }
      else
        startedCb && startedCb(null, true)

      return function (cb) {
        debug('Closing server on %s:%d', opts.host, opts.port)
        server.close(function(err) {
          if (err) console.error(err)
          else debug('No longer listening on %s:%d', opts.host, opts.port)
          if (cb) cb(err)
        })
      }
    },
    client: function (addr, cb) {
      if(!addr.host) {
        addr.hostname = addr.hostname || opts.host || 'localhost'
        addr.slashes = true
        addr = URL.format(addr)
      }
      if('string' !== typeof addr)
        addr = URL.format(addr)

      var stream = WS.connect(addr, {
        binaryType: opts.binaryType,
        onConnect: function (err) {
          //ensure stream is a stream of node buffers
          stream.source = pull(stream.source, Map(Buffer.from.bind(Buffer)))
          cb(err, stream)
        }
      })
      stream.address = addr

      return function () {
        stream.close(cb)
      }
    },
    stringify: function (targetScope = 'device') {
      if (WS.createServer == null) {
        return null
      }
      if (isAllowedScope(targetScope) === false) {
        return null
      }

      const port = opts.server ? opts.server.address().port : opts.port
      const externalHost = targetScope === 'public' && opts.external
      const resultHost = externalHost || opts.host || scopes.host(targetScope)

      if (resultHost == null) {
        // The device has no network interface for a given `targetScope`.
        return null
      }

      return URL.format({
        protocol: secure ? 'wss' : 'ws',
        slashes: true,
        hostname: resultHost,
        port: (secure ? port == 443 : port == 80) ? undefined : port
      })
    },
    parse: function (str) {
      var addr = URL.parse(str)
      if(!/^wss?\:$/.test(addr.protocol)) return null
      return addr
    }
  }
}




