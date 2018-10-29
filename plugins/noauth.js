var pull = require('pull-stream')

module.exports = function (opts) {
  opts = opts || {}
  return {
    name: 'noauth',
    create: function (_opts) {
      return function (stream, cb) {
        if(opts.footgun !== true && stream.address !== opts.address)
          return cb(new Error('noauth transform not allowed for remote address '+stream.address))
        var public = opts.keys && opts.keys.publicKey
        var id = public && public.toString('base64')
        cb(null, {
          remote: public,
          auth: { allow: null, deny: null },
          source: stream.source,
          sink: stream.sink,
          address: 'noauth:' + id
        })
      }
    },
    parse: function (str) {
      return {}
    },
    stringify: function () {
      return 'noauth'
    }
  }
}


