//create multiple types of server in one go.
/*
  net-shs:
    ip, port, keypair

  [['net', ip, port], ['shs', keypair]]

  [host, port, 'net', keypair, 'shs']

  [host, port, 'ws', keypair, 'shs']

  [shs:key,net:port:host/url]

*/

function parse (u) {
  var proto = u && 'object' == typeof u ? u : require('url').parse(u)
  proto.protocol = proto.protocol.replace(/:$/, '')
  return proto
}

module.exports = function (handlers) {
  function findProto (opts) {
    if(!opts) throw new Error('expected protocol descritpion')
    return handlers.find(function (e) {
      return e.protocol == opts.protocol
    })
  }

  return {
    createServer: function (opts, onConnection) {
      var closes = []
      opts.forEach(function (proto) {
        var p = findProto(proto)
        if(p) closes.push(p.createServer(proto, onConnection))
      })
      return function () {
        closes.forEach(function (close) { close () })
      }
    },
    connect: function (address, cb) {
      var p = findProto(parse(address))
      if(p) p.connect(address, cb)
      else cb(new Error('could not connect to:'+JSON.stringify(address)))
    }
  }
}












