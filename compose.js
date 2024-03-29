const SEPARATOR = '~'
const ESCAPE = '!'
const SE = require('separator-escape')(SEPARATOR, ESCAPE)

function head(x) {
  return Array.isArray(x) ? x[0] : x
}

function tail(x) {
  return Array.isArray(x) ? x.slice(1) : []
}

function compose(stream, transforms, cb) {
  if (!stream) throw new Error('multiserver.compose: *must* pass stream')
  ;(function next(err, stream, i, addr) {
    if (err) {
      err.address = addr + '~' + err.address
      return cb(err)
    } else if (i >= transforms.length) {
      stream.address = addr
      return cb(null, stream)
    } else
      transforms[i](stream, (err, _stream) => {
        if (!err && !stream) throw new Error('expected error or stream')
        if (_stream) _stream.meta = _stream.meta || stream.meta
        next(err, _stream, i + 1, err ? addr : addr + '~' + _stream.address)
      })
  })(null, stream, 0, stream.address)
}

function asyncify(f) {
  return function fnAsAsync(cb) {
    if (f.length) return f(cb)
    if (cb) {
      let result
      try {
        result = f()
      } catch (err) {
        return cb(err)
      }
      return cb(null, result)
    }
    return f()
  }
}

function identity(x) {
  return x
}

module.exports = function Compose(ary, wrap) {
  if (!wrap) wrap = identity
  const proto = head(ary)
  const trans = tail(ary)

  function parse(str) {
    const parts = SE.parse(str)
    const out = []
    for (let i = 0; i < parts.length; i++) {
      const v = ary[i].parse(parts[i])
      if (!v) return null
      out[i] = v
    }
    return out
  }

  function parseMaybe(str) {
    return typeof str === 'string' ? parse(str) : str
  }

  return {
    name: ary.map((e) => e.name).join(SEPARATOR),

    scope: proto.scope,

    client(_opts, cb) {
      const opts = parseMaybe(_opts)
      if (!opts) return cb(new Error('could not parse address:' + _opts))
      return proto.client(head(opts), (err, stream) => {
        if (err) return cb(err)
        compose(
          wrap(stream),
          trans.map((tr, i) => tr.create(opts[i + 1])),
          cb
        )
      })
    },

    // There should be a callback , called with null when the server started to
    // listen. (net.server.listen is async for example)
    server(onConnection, onError, onStart) {
      onError =
        onError ||
        function onServerError(err) {
          console.error('server error, from', err.address)
          console.error(err)
        }
      return asyncify(
        proto.server(function onComposedConnection(stream) {
          compose(
            wrap(stream),
            trans.map((tr) => tr.create()),
            (err, stream) => {
              if (err) onError(err)
              else onConnection(stream)
            }
          )
        }, onStart)
      )
    },

    parse: parse,

    stringify(scope) {
      const addresses = []
      const fullAddress = proto.stringify(scope)
      if (!fullAddress) return
      else {
        const splittedAddresses = fullAddress.split(';')
        if (splittedAddresses.length > 1) {
          // More than one hostname needs to be updated
          addresses.push(...splittedAddresses)
        } else {
          addresses.push(fullAddress)
        }
      }
      return addresses
        .map((addr) => {
          const singleAddr = [addr].concat(trans.map((t) => t.stringify(scope)))
          return SE.stringify(singleAddr)
        })
        .join(';')
    },
  }
}
