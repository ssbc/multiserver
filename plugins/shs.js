const SecretHandshake = require('secret-handshake')
const pull = require('pull-stream')

module.exports = function Shs(opts) {
  const keys = SecretHandshake.toKeys(opts.keys || opts.seed)
  const appKey =
    typeof opts.appKey === 'string'
      ? Buffer.from(opts.appKey, 'base64')
      : opts.appKey

  const server = SecretHandshake.createServer(
    keys,
    opts.auth || opts.authenticate,
    appKey,
    opts.timeout
  )
  const client = SecretHandshake.createClient(keys, appKey, opts.timeout)

  return {
    name: 'shs',
    create(_opts) {
      return function shsTransform(stream, cb) {
        function _cb(err, stream) {
          if (err) {
            // shs is designed so that we do not _know_ who is connecting if it
            // fails, so we probably can't add the connecting address. (unless
            // it was client unauthorized)
            err.address = 'shs:'
            return cb(err)
          }
          stream.address = 'shs:' + stream.remote.toString('base64')
          cb(null, stream)
        }
        pull(
          stream.source,
          _opts && _opts.key ? client(_opts.key, _opts.seed, _cb) : server(_cb),
          stream.sink
        )
      }
    },

    parse(str) {
      const ary = str.split(':')
      if (ary[0] !== 'shs') return null
      let seed = undefined
      // Seed of private key to connect with, optional.
      if (ary.length > 2) {
        seed = Buffer.from(ary[2], 'base64')
        if (seed.length !== 32) return null
      }
      const key = Buffer.from(ary[1], 'base64')
      if (key.length !== 32) return null
      return { key: key, seed: seed }
    },

    stringify() {
      if (!keys) return
      return 'shs:' + keys.publicKey.toString('base64')
    },
    publicKey: keys && keys.publicKey,
  }
}
