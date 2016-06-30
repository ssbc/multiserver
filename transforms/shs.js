var SHS = require('secret-handshake')
var pull = require('pull-stream')

module.exports = function (keys, app_key, timeout, auth) {
  return function shs (opts) { //remote key, if client
    console.log('create shs')
    if(opts.key) {
      return function (stream, cb) {
        console.log('encrypt', stream)
        pull(
          stream.source,
          pull.through(console.log),
          SHS.createClient(keys, app_key, timeout)(opts.key, cb),
          stream.sink
        )
      }
    }
    else
      return function (stream, cb) {
        pull(
          stream.source,
          SHS.createServer(keys, auth, app_key, timeout)(cb),
          stream.sink
        )
      }
  }
}

