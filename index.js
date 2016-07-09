var compose = require('./compose')
var isArray = Array.isArray

function split(str) {
  return isArray(str) ? str : str.split(';')
}

module.exports = function (plugs) {

  plugs = plugs.map(function (e) {
    return isArray(e) ? compose(e) : e
  })

  return {
    name: plugs.map(function (e) { return e.name }).join(';'),
    client: function (addr, cb) {
      var plug
      split(addr).find(function (addr) {
        //connect with the first plug that understands this string.
        plug = plugs.find(function (plug) {
          return plug.parse(addr)
        })
      })
      if(plug) plug.client(addr, cb)
      else cb(new Error('could not connect to one of:'+addr))
    },
    server: function (onConnect, onError) {
      //start all servers
      var closes = plugs.map(function (plug) {
        return plug.server(onConnect, onError)
      })

      return function () {
        closes.forEach(function (close) { close() })
      }
    },
    stringify: function () {
      return plugs.map(function (plug) {
        return plug.stringify()
      }).join(';')
    },
    //parse doesn't really make sense here...
    //like, what if you only have a partial match?
    //maybe just parse the ones you understand?
    parse: function (str) {
      return str.split(';').map(function (e, i) {
        return plugs[i].parse(e)
      })
    }
  }
}

