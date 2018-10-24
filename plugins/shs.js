var SHS = require('secret-handshake')
var pull = require('pull-stream')

function isString(s) {
  return 'string' === typeof s
}

module.exports = function (opts) {
  var keys = SHS.toKeys(opts.keys || opts.seed)
  var appKey = isString(opts.appKey) ? Buffer.from(opts.appKey, 'base64') : opts.appKey

  var server = SHS.createServer(
    keys, opts.auth || opts.authenticate, appKey, opts.timeout
  )
  var client = SHS.createClient(
    keys, appKey, opts.timeout
  )

  return {
    name: 'shs',
    create: function (_opts) {
      return function (stream, cb) {
        function _cb (err, stream) {
          if(err) {
            //shs is designed so that we do not _know_ who is connecting if it fails,
            //so we probably can't add the connecting address. (unless it was client unauthorized)
            err.address = 'shs:'
            return cb(err)
          }
          stream.address = 'shs:'+stream.remote.toString('base64')
          cb(null, stream)
        }
        pull(
          stream.source,
          _opts && _opts.key ? client(_opts.key, _opts.seed, _cb) : server(_cb),
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
        seed = Buffer.from(ary[2], 'base64')
        if(seed.length !== 32) return null
      }
      var key = Buffer.from(ary[1], 'base64')
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





