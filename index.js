'use strict'
/*
API

currently:

install plugins

then describe server.

then describe connection.

considered create plugins + describe server in one go,
but some plugins (i.e. security) might be installed in more than one
place... we don't want to have to describe each possible client
combination.

also, some plugins have state (like access to keys)
that should be set one time.

or maybe we do want to preconfigure the clients and servers
that are acceptable? we shouldn't we shouldn't just connect via
any string description we can parse.

ms = MultiServer([
  server(opts),
  [server(opts), security(opts), compression(opts)]//...
])

MultiServer()
  .useServers([...]) //net~shs; ws~shs; utp~shs; webrtc~shs; tor~shs;
  .useClients([...])
  .createServer(function (stream) {...})
  .connect(string, function (err, stream) {...})


ms.combine(server, transform, transform) //etc

hmm, okay so one thing we def need is to take a server chain
and produce a address string. maybe I should do that next?

*/


//create multiple types of server in one go.
/*
  net-shs:
    ip, port, keypair

  [['net', ip, port], ['shs', keypair]]

  [host, port, 'net', keypair, 'shs']

  [host, port, 'ws', keypair, 'shs']

  [shs:key,net:port:host/url]

*/

var isArray = Array.isArray
function head (opts) {
  return isArray(opts) ? opts[0] : opts
}
function tail (opts) {
  return isArray(opts) ? opts.slice(1) : []
}

function compose (stream, transforms, cb) {
  ;(function next (err, stream, i) {
    if(err) return cb(err)
    else if(i >= transforms.length) return cb(null, stream)
    else
      transforms[i](stream, function (err, stream) {
        next(err, stream, i+1)
      })
  })(null, stream, 0)
}

function parse (u) {
  return u && 'object' == typeof u ? u : require('url').parse(u)
}

module.exports = function (handlers) {
  function findProto (opts) {
    if(!opts) throw new Error('expected protocol description')
    return handlers.find(function (e) {
      var protocol = opts.protocol.replace(/:$/,'')
      return e.protocol == protocol || e.name == protocol
    })
  }

  function transforms (opts, isServer) {
    return opts.map(function (opt) {
      var create = findProto(opt)(opt) // create server???
      return function (stream, cb) {
        create(stream, cb)
      }
    })
  }

  return {
    createServer: function (opts, onConnection) {
      var closes = []
      opts.forEach(function (proto) {
        var p = findProto(head(proto))
        if(p) closes.push(p.createServer(head(proto), function (stream) {
          compose(stream, transforms(tail(proto), true), function (err, stream) {
            if(err) console.error(err)
            else onConnection(stream)
          })
        }))
      })
      return function () {
        closes.forEach(function (close) { close () })
      }
    },
    connect: function (address, cb) {
      var opts = parse(address)
      var p = findProto(head(opts))
      if(p) p.connect(head(opts), function (err, stream) {
        if(err) cb(err)
        else compose(stream, transforms(tail(opts), false), cb)
      })
      else cb(new Error('could not connect to:'+JSON.stringify(address)))
    }
  }
}

