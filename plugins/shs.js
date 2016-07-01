var SHS = require('secret-handshake')
var pull = require('pull-stream')

module.exports = function (opts) {
  var server = SHS.createServer(
    opts.keys, opts.auth, opts.appKey, opts.timeout
  )
  var client = SHS.createClient(
    opts.keys, opts.appKey, opts.timeout
  )
  return {
    name: 'shs',
    create: function (_opts) {
      return function (stream, cb) {
        pull(
          stream.source,
          _opts && _opts.key ? client(_opts.key, cb) : server(cb),
          stream.sink
        )
      }
    },
    parse: function (str) {
      var ary = str.split(':')
      if(ary[0] !== 'shs') return null
      var key = new Buffer(ary[1], 'base64')
      if(key.length !== 32) return null
      return {key: key}
    },
    stringify: function () {
      return 'shs:'+opts.keys.publicKey.toString('base64')
    }
  }

}




