var assert = require('assert')
var separator = '~', escape = '!'
var SE = require('separator-escape')(separator, escape)

var isArray = Array.isArray
function isFunction (f) {
  return 'function' === typeof f
}
function isString (s) {
  return 'string' === typeof s
}
function head (opts) {
  return isArray(opts) ? opts[0] : opts
}
function tail (opts) {
  return isArray(opts) ? opts.slice(1) : []
}

function compose (stream, transforms, cb) {
  ;(function next (err, stream, i, addr) {
    if(err) {
      console.log(addr + '~' + err.address)
      err.address = addr + '~' + err.address
      return cb(err)
    }
    else if(i >= transforms.length) {
      stream.address = addr
      return cb(null, stream)
    }
    else
      transforms[i](stream, function (err, stream) {
        next(err, stream, i+1, err ? addr : addr+'~'+stream.address)
      })
  })(null, stream, 0, stream.address)
}

module.exports = function (ary) {
  var proto = head(ary)
  var trans = tail(ary)

  function parse (str) {
    var parts = SE.parse(str)
    var out = []
    for(var i = 0; i < parts.length; i++) {
      var v = ary[i].parse(parts[i])
      if(!v) return null
      out[i] = v
    }
    return out
  }

  function parseMaybe (str) {
    return  isString(str) ? parse(str) : str
  }

  return {
    name: ary.map(function (e) { return e.name }).join(separator),
    client: function (_opts, cb) {
      var opts = parseMaybe(_opts)
      if(!opts) return cb(new Error('could not parse address:'+_opts))
      proto.client(head(opts), function (err, stream) {
        if(err) return cb(err)
        compose(
          stream,
          trans.map(function (tr, i) { return tr.create(opts[i+1]) }),
          cb
        )
      })
    },
    server: function (onConnection, onError) {
      onError = onError || function (err) {
        console.error('server error, from', err.address)
        console.error(err.stack)
      }
      return proto.server(function (stream) {
        compose(
          stream,
          trans.map(function (tr) { return tr.create() }),
          function (err, stream) {
            if(err) onError(err)
            else onConnection(stream)
          }
        )
      })
    },
    parse: parse,
    stringify: function () {
      var none
      var _ary = ary.map(function (e) {
        var v = e.stringify()
        if(!v) none = true
        else return v
      })
      if(none) return
      return SE.stringify(_ary)
    }
  }
}





