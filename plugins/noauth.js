module.exports = function Noauth(opts) {
  return {
    name: 'noauth',
    create(_opts) {
      return function noauthTransform(stream, cb) {
        cb(null, {
          remote: opts.keys.publicKey,
          auth: { allow: null, deny: null },
          source: stream.source,
          sink: stream.sink,
          address: 'noauth:' + opts.keys.publicKey.toString('base64'),
        })
      }
    },
    parse(str) {
      return {}
    },
    stringify() {
      return 'noauth'
    },
  }
}
