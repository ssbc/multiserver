var SHS = require('secret-handshake')
var pull = require('pull-stream')

module.exports = function (opts) {
  var keys = SHS.toKeys(opts.keys || opts.seed)
  var server = SHS.createServer(
    keys, opts.auth || opts.authenticate, opts.appKey, opts.timeout
  )
  var client = SHS.createClient(
    keys, opts.appKey, opts.timeout
  )

  return {
    name: 'shs',
    create: function (_opts) {
      return function (stream, cb) {
        pull(
          stream.source,
          _opts && _opts.key ? client(_opts.key, _opts.seed, cb) : server(cb),
          stream.sink
        )
      }
    },
    parse: function (str) {
      var ary = str.split(':')
      if(ary[0] !== 'shs') return null
      var seed = undefined

      //seed of private key to connect with, optional.

      if(ary.length > 2) {
        seed = new Buffer(ary[2], 'base64')
        if(seed.length !== 32) return null
      }
      var key = new Buffer(ary[1], 'base64')
      if(key.length !== 32) return null

      return {key: key, seed: seed}
    },
    stringify: function () {
      if(!keys) return
      return 'shs:'+keys.publicKey.toString('base64')
    },
    publicKey: keys && keys.publicKey
  }
}




