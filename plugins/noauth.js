var pull = require('pull-stream')

module.exports = function (opts) {
  return {
    name: 'noauth',
    create: function (_opts) {
      return function (stream, cb) {
        stream.address = 'noauth'
        cb(null, {
          remote: '',
          auth: { allow: null, deny: null },
          source: stream.source,
          sink: stream.sink
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





