var WS = require('pull-ws')
var URL = require('url')
var pull = require('pull-stream/pull')
var Map = require('pull-stream/throughs/map')
var scopes = require('multiserver-scopes')

function safe_origin (origin, address, port) {

  //if the connection is not localhost, we shouldn't trust
  //the origin header. So, use address instead of origin
  //if origin not set, then it's definitely not a browser.
  if(!(address === '::1' || address === '128.0.0.1') || origin == undefined)
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

module.exports = function (opts) {
  opts = opts || {}
  opts.binaryType = (opts.binaryType || 'arraybuffer')
  var scope = opts.scope || 'device'
  function isScoped (s) {
    return s === scope || Array.isArray(scope) && ~scope.indexOf(s)
  }

  var secure = opts.server && !!opts.server.key
  return {
    name: 'ws',
    scope: function() { return opts.scope || 'device' },
    server: function (onConnect) {
      if(!WS.createServer) return
      // Choose a dynamic port between 49152 and 65535
      // https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers#Dynamic,_private_or_ephemeral_ports
      opts.port = opts.port || Math.floor(49152 + (65535 - 49152 + 1) * Math.random())
      var server = WS.createServer(opts, function (stream) {
        stream.address = safe_origin(
          stream.headers.origin,
          stream.remoteAddress,
          stream.remotePort
        )
        onConnect(stream)
      })

      if(!opts.server) {
        console.log('Listening on ' + opts.host +':' + opts.port + ' (multiserver ws plugin)')
        server.listen(opts.port)
      }
      return function (cb) {
        console.log('Closing server on ' + opts.host +':' + opts.port + ' (multiserver ws plugin)')
        server.close(function(err) {
          if (err) console.error(err)
          else console.log('No longer listening on ' + opts.host +':' + opts.port + ' (multiserver ws plugin)')
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
    stringify: function (scope) {
      scope = scope || 'device'
      if(!isScoped(scope)) return null
      if(!WS.createServer) return null
      var port
      if(opts.server)
        port = opts.server.address().port
      else
        port = opts.port

      var host = (scope == 'public' && opts.external) || scopes.host(scope)
      //if a public scope was requested, but a public ip is not available, return
      if(!host) return null

      return URL.format({
        protocol: secure ? 'wss' : 'ws',
        slashes: true,
        hostname: host,
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




