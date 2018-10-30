
var getHost = require('multiserver-scopes').host

function isString (s) {
  return 'string' === typeof s
}

var isArray = Array.isArray

module.exports = function (port, scopes, createServer) {
  scopes = scopes || 'public'
  if(isString(scopes)) {
    var server = createServer().listen(port, getHost(scopes))
    return function (cb) {
      server.close(function (err) {
        cb && cb(err)
      })
    }
  }
  else if(isArray(scopes)) {
    var servers = scopes.map(function (scope) {
      return createServer().listen(port, getHost(scope))
    })
    return function (cb) {
      var n = servers.length, err
      servers.forEach(function (server) { 
        server.close(function (_err) {
          err = err || _err
          if(--n) return
          cb && cb(err)
        })
      })
    }
  }
  else
    throw new Error('missing scopes')
}





