module.exports = function (opts) {
  return {
    name: 'noauth',
    create: function () {
      return function (stream, cb) {
        cb(null, {
          remote: opts.keys.publicKey,
          auth: { allow: null, deny: null },
          source: stream.source,
          sink: stream.sink,
          address: 'noauth:' + opts.keys.publicKey.toString('base64')
        })
      }
    },
    parse: function () {
      return {}
    },
    stringify: function () {
      return 'noauth'
    }
  }
}
