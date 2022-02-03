const toDuplex = require('stream-to-pull-stream').duplex
const net = require('net')
const fs = require('fs')
const path = require('path')
const debug = require('debug')('multiserver:unix')
const os = require('os')

// hax on double transform
let started = false

module.exports = function Unix(opts) {
  if (process.platform === 'win32') {
    opts.path =
      opts.path || path.join('\\\\?\\pipe', process.cwd(), 'multiserver')
  } else {
    opts.path =
      opts.path || fs.mkdtempSync(path.join(os.tmpdir(), 'multiserver-'))
  }

  const socket = path.join(opts.path, 'socket')
  const addr = 'unix:' + socket
  let scope = opts.scope || 'device'
  opts = opts || {}
  return {
    name: 'unix',
    scope: () => scope,
    server(onConnection, cb) {
      if (started) return

      if (scope !== 'device') {
        debug('Insecure scope for unix socket! Reverting to device scope')
        scope = 'device'
      }

      debug('listening on socket %s', addr)

      const server = net
        .createServer(opts, function connectionListener(stream) {
          stream = toDuplex(stream)
          stream.address = addr
          onConnection(stream)
        })
        .listen(socket, cb)

      server.on('error', function onError(err) {
        if (err.code === 'EADDRINUSE') {
          const clientSocket = new net.Socket()
          clientSocket.on('error', function onClientSocketError(e) {
            if (e.code === 'ECONNREFUSED') {
              fs.unlinkSync(socket)
              server.listen(socket)
            }
          })

          clientSocket.connect(
            { path: socket },
            function socketConnectionListener() {
              debug('someone else is listening on socket!')
            }
          )
        }
      })

      if (process.platform !== 'win32') {
        // mode is set to allow read and write
        const mode = fs.constants.S_IRUSR + fs.constants.S_IWUSR
        fs.chmodSync(socket, mode)
      }

      started = true

      return function closeUnixSocketServer() {
        server.close()
      }
    },

    client(opts, cb) {
      debug('unix socket client')
      let started = false
      const stream = net
        .connect(opts.path)
        .on('connect', function onConnect() {
          if (started) return
          started = true
          var _stream = toDuplex(stream)
          _stream.address = addr
          cb(null, _stream)
        })
        .on('error', function onError(err) {
          debug('err? %o', err)
          if (started) return
          started = true
          cb(err)
        })

      return function closeUnixSocketClient() {
        started = true
        stream.destroy()
        cb(new Error('multiserver.unix: aborted'))
      }
    },

    // MUST be unix:socket_path
    parse(s) {
      const ary = s.split(':')

      // Immediately return if there's no path.
      if (ary.length < 2) return null

      // Immediately return if the first item isn't 'unix'.
      if ('unix' !== ary.shift()) return null

      return {
        name: '',
        path: ary.join(':'),
      }
    },

    stringify(_scope) {
      if (scope !== _scope) return null
      return ['unix', socket].join(':')
    },
  }
}
