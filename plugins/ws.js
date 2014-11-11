
var toPull = require('stream-to-pull-stream')
var ws = require('ws')
var pws = require('pull-ws')
var pull = require('pull-stream')
var cat = require('pull-cat')
var url = require('url')
var crypto = require('crypto')

var EventEmitter = require('events').EventEmitter

var http = require('http')

exports.createServer = function (onConnection) {

  var emitter = new EventEmitter()

  if(onConnection) emitter.on('connection', onConnection)

//http.createServer(function (req, res) {
//    emitter.emit('connection', {
//      headers: req.headers,
//      setHeader: res.setHeader.bind(res),
//      writeHead: res.writeHead.bind(res),
//      source: toPull.source(req),
//      sink: toPull.sink(res)
//    }, 'http')
//  })
//  .on('upgrade', function (req, socket, head) {
//
//    var key = req.headers['sec-websocket-key'];
//    var shasum = crypto.createHash('sha1');
//    shasum.update(key + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11");
//    key = shasum.digest('base64');
//
//  // c/p from node docs
//  // http://nodejs.org/api/http.html#http_event_upgrade_1
//  socket.write('HTTP/1.1 101 Web Socket Protocol Handshake\r\n' +
//               'Upgrade: WebSocket\r\n' +
//                'Sec-WebSocket-Accept:'+ key + '\r\n' +
//               'Connection: Upgrade\r\n' +
//               '\r\n');
//
//    var d = toPull.duplex(socket)
//    if(!head.length)
//      emitter.emit('connection', d, 'ws')
//    else
//      emitter.emit('connection', {
//        source: cat([pull.values([head]), d.source]),
//        sink: d.sink
//      }, 'ws')
//
//  })
//
  emitter.listen = function (port, onListening) {
    var server = new ws.Server({port: port})
      .on('connection', function (ws) {
        emitter.emit('connection', pws(ws), 'ws')
      })
    if(onListening) server.on('listening', onListening)

//    server.listen(port, onListening)
    return emitter
  }

  emitter.close = function (cb) {
    server.close(cb)
    return emitter
  }

  return emitter
}

exports.connect = function (port, path) {
  var WebSocket = require('ws')
  var u  = url.format({
    hostname: 'localhost',
    port: port,
    pathname: path || '/',
    protocol: 'ws',
    slashes: true
  })
  var socket = new WebSocket(u)
  return pws(socket)
}


if(!module.parent) {
  var pws = exports.connect(8001)
  var goodbye = require('pull-goodbye')

  pull(
    pws,
    goodbye({
      source:toPull.source(process.stdin),
      sink: toPull.sink(process.stdout)
    }),
    pws
  )

//    pull.through(console.log),
//    pull.infinite(function () {
//      return new Date().toString()
//    }),
//    pull.drain(console.log)
//  )
//  exports.createServer(function (s, type) {
//    console.log(type, 'connection')
//    pull(s.source, pull.through(function (s) { console.log(s.toString())}), s.sink) //echo server
//  }).listen(8000)
}
