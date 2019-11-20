const cartesianProduct = require('cartesian-product')

var separator = '~', escape = '!'
var SE = require('separator-escape')(separator, escape)

var isArray = Array.isArray
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

// We can't call `cartesianProduct()` directly because it expects `[layer[]?]`.
//
// Sometimes this function is called with the correct inputs, but often it's
//
// - `undefined`
// - `[undefined, layer]`
// - etc
//
// Since the `cartesianProduct()` function fails on any expected inputs, this
// function ensures that we're always passing a `[]` or a 2-dimensional array.
const combineLayers = (input = []) =>
  cartesianProduct(
    input.map((item) =>
      Array.isArray(item) ? item : []
    )
  )

module.exports = function (layers, wrap) {
  if(!wrap) wrap = function (e) { return e }
  var protocol = head(layers)
  var transform = tail(layers)

  function parse (str) {
    // We need to parse addresses that may be delimited by semicolons. The goal
    // is to return the first address that's understood by all layers. For
    // example, if we're using the `net` and `shs` plugins then we need to
    // ensure that **both** plugins can understand the multiserver address that
    // we listen on.
    return str.split(';')
      .map((singleAddress) => {
        // First we split the multiserver address into parts.
        // This might look like: [ "net:localhost:8008", "shs:abc" ]
        const parts = SE.parse(singleAddress)

        // Next we need to ensure that all of our layers can parse their part.
        const parsedParts = parts.map((part, index) => layers[index].parse(part))

        // The layer parsers don't throw errors, so we need ot make sure that
        // they return a truthy value for all parts.
        const allLayersHandled = parsedParts.every((part) => part)

        if (allLayersHandled) {
          return parsedParts
        } else {
          return null
        }
      }).find(option =>
        // Find the first option where all layers are handled.
        option !== null
      ) || null // Fallback to `null` if we can't correctly parse this address.
  }

  function parseMaybe (str) {
    return  isString(str) ? parse(str) : str
  }

  return {
    name: layers.map(function (e) { return e.name }).join(separator),
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

      var identifierAry = combineLayers(layers.map(function (item) {
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

