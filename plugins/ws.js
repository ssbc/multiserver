var WS = require('pull-ws')
var URL = require('url')
var pull = require('pull-stream/pull')
var Map = require('pull-stream/throughs/map')

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

module.exports = function (opts) {
  opts = opts || {}
  opts.binaryType = (opts.binaryType || 'arraybuffer')
  var secure = opts.server && !!opts.server.key
  return {
    name: 'ws',
    scope: function() { return opts.scope || 'public' },
    server: function (onConnect) {
      if(!WS.createServer) return
      var server = WS.createServer(opts, function (stream) {
        stream.address = safe_origin(
          stream.headers.origin,
          stream.remoteAddress,
          stream.remotePort
        )
        onConnect(stream)
      })

      if(!opts.server) server.listen(opts.port)
      return server.close.bind(server)
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
          stream.source = pull(stream.source, Map(Buffer))
          cb(err, stream)
        }
      })
      stream.address = addr

      return function () {
        stream.close(cb)
      }
    },
    stringify: function () {
      if(!WS.createServer) return
      var port
      if(opts.server)
        port = opts.server.address().port
      else
        port = opts.port

      return URL.format({
        protocol: secure ? 'wss' : 'ws',
        slashes: true,
        hostname: opts.host || 'localhost', //detect ip address
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

