const multicb = require('multicb')
const compose = require('./compose')
const isArray = Array.isArray

function split(str) {
  return isArray(str) ? str : str.split(';')
}

module.exports = function Multiserver(plugs, wrap) {
  plugs = plugs.map((e) => (isArray(e) ? compose(e, wrap) : e))

  const _self = {
    name: plugs.map((e) => e.name).join(';'),

    client(addr, cb) {
      let plug
      const _addr = split(addr).find((addr) => {
        // connect with the first plug that understands this string.
        plug = plugs.find((plug) => (plug.parse(addr) ? plug : null))
        if (plug) return addr
      })
      if (plug) plug.client(_addr, cb)
      else
        cb(
          new Error(
            'could not connect to:' + addr + ', only know:' + _self.name
          )
        )
    },

    server(onConnect, onError, startedCb) {
      //start all servers

      if (!startedCb) {
        // If a callback is not registered to be called back when the servers are
        // fully started, our default behaviour is just to print any errors starting
        // the servers to the log
        startedCb = (err, result) => {
          if (err) {
            console.error('Error starting multiserver server: ' + err)
          }
        }
      }

      const started = multicb()

      const closes = plugs
        .map((plug) => plug.server(onConnect, onError, started()))
        .filter(Boolean)

      started(startedCb)

      return function closeMultiserverServer(cb) {
        let done
        if (cb) done = multicb()
        for (const close of closes) {
          if (done && close.length) close(done())
          else close()
        }
        if (done) done(cb)
      }
    },

    stringify(scope) {
      if (!scope) scope = 'device'
      return plugs
        .filter((plug) => {
          const _scope = plug.scope()
          return Array.isArray(_scope)
            ? ~_scope.indexOf(scope)
            : _scope === scope
        })
        .map((plug) => plug.stringify(scope))
        .filter(Boolean)
        .join(';')
    },

    // parse doesn't really make sense here...
    // like, what if you only have a partial match?
    // maybe just parse the ones you understand?
    parse(str) {
      return str.split(';').map((e, i) => plugs[i].parse(e))
    },
  }
  return _self
}
