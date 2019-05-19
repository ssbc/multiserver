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
  if(!stream) throw new Error('multiserver.compose: *must* pass stream')
  ;(function next (err, stream, i, addr) {
    if(err) {
      err.address = addr + '~' + err.address
      return cb(err)
    }
    else if(i >= transforms.length) {
      stream.address = addr
      return cb(null, stream)
    }
    else
      transforms[i](stream, function (err, _stream) {
        if(!err && !stream) throw new Error('expected error or stream')
        if(_stream) _stream.meta = _stream.meta || stream.meta
        next(err, _stream, i+1, err ? addr : (addr+'~'+_stream.address))
      })
  })(null, stream, 0, stream.address)
}

function asyncify(f) {
  return function(cb) {
    if (f.length) return f(cb)
    if (cb) {
      var result
      try{
        result = f()
      } catch(err) {return cb(err)}
      return cb(null, result)
    }
    return f()
  }
}

// This accepts an array of arrays and outputs a combination of their layers.
//
// combineLayers([ [ 1, 2 ], [ 3, 4] ]) // => [
//   [ 1, 3 ],
//   [ 1, 4 ],
//   [ 2, 3 ],
//   [ 2, 4 ]
// ]
//
// This is used for combining plugin layers, like when the net plugin is
// listening on multiple addresses and we want to make sure that we combine
// all of the addresses with all of the transforms when we stringify.
//
// combineLayers([ [ 'net:a', 'net:b' ], [ 'shs:c' ] ]) // => [
//   [ 'net:a', 'shs:c' ],
//   [ 'net:b', 'shs:c' ]
// ]
const combineLayers = x =>
  x.reduce((acc, group = []) =>
    acc.map(chain =>
      group.map((item) =>
        chain.concat(item))
    ).reduce((acc, val) =>
      // alternative to `Array.prototype.flat()`
      acc.concat(val), []
    ),
    [[]]
  )

module.exports = function (ary, wrap) {
  if(!wrap) wrap = function (e) { return e }
  var protocol = head(ary)
  var transform = tail(ary)

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
    return  isString(str) ? parse(str.split(';')[0]) : str
  }

  return {
    name: ary.map(function (e) { return e.name }).join(separator),
    scope: protocol.scope,
    client: function (_opts, cb) {
      var opts = parseMaybe(_opts)
      if(!opts) return cb(new Error('could not parse address:'+_opts))
      return protocol.client(head(opts), function (err, stream) {
        if(err) return cb(err)
        compose(
          wrap(stream),
          transform.map(function (tr, i) { return tr.create(opts[i+1]) }),
          cb
        )
      })
    },
    // There should be a callback , called with
    // null when the server started to listen.
    // (net.server.listen is async for example)
    server: function (onConnection, onError, onStart) {
      onError = onError || function (err) {
        console.error('server error, from', err.address)
        console.error(err.stack)
      }
      return asyncify(protocol.server(function (stream) {
        compose(
          wrap(stream),
          transform.map(function (tr) { return tr.create() }),
          function (err, stream) {
            if(err) onError(err)
            else onConnection(stream)
          }
        )
      }, onStart))
    },
    parse: parse,
    stringify: function (scope) {
      var none

      var identifierAry = combineLayers(ary.map(function (item) {
        var v = item.stringify(scope)
        if (typeof v === 'string') {
          v = v.split(';')
        }

        if(!v) none = true
        else return v
      }))

      if(none) return
      return identifierAry.map(id => SE.stringify(id)).join(';')
    }
  }
}

