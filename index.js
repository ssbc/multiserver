var compose = require('./compose')
var isArray = Array.isArray

function split(str) {
  return isArray(str) ? str : str.split(';')
}

module.exports = function (plugs, wrap) {

  plugs = plugs.map(function (e) {
    return isArray(e) ? compose(e, wrap) : e
  })

  return {
    name: plugs.map(function (e) { return e.name }).join(';'),
    client: function (addr, cb) {
      var _addr = split(addr).find(function (addr) {
        //connect with the first plug that understands this string.
        plug = plugs.find(function (plug) {
          return plug.parse(addr) ? plug : null
        })
        if(plug) return addr
      })
      if(plug) plug.client(_addr, cb)
      else cb(new Error('could not connect to:'+addr+', only know:'+this.name))
    },
    server: function (onConnect, onError) {
      //start all servers
      var closes = plugs.map(function (plug) {
        return plug.server(onConnect, onError)
      }).filter(Boolean)

      return function () {
        closes.forEach(function (close) { close() })
      }
    },
    stringify: function (scope) {
      if (!scope) scope = 'public'
      return plugs
        .filter(function (plug) {
          return plug.scope() === scope ||
            (plug.scope() === 'public' && scope === 'private')
        })
        .map(function (plug) { return plug.stringify(scope) })
        .filter(Boolean)
        .join(';')
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

