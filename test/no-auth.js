
var tape = require('tape')
var NoAuth = require('../plugins/noauth')
var Unix = require('../plugins/unix-socket')
var Net = require('../plugins/net')
var Ws = require('../plugins/ws')
var fs = require('fs')
var path = require('path')
var MultiServer = require('../')
var Compose = require('../compose')

tape('unix~noauth', function (t) {
  var dir ='/tmp/test_multiserver_noauth'
  var socket = dir + '/socket'
  try { fs.mkdirSync(dir) } catch (_) {}
  try { fs.unlinkSync(socket) } catch (_) { }

  var unixno =     Compose([Unix({path: dir, server: true}), NoAuth({})])

  var ms = MultiServer([unixno])

  var close = ms.server(function (stream) {
    console.log('server', stream)
//    t.end()
//    close()
//    stream.source(true, function () {})
  })

  var addr = ms.stringify()
  console.log('address', addr)
  t.equal(addr, 'unix:/tmp/test_multiserver_noauth/socket~noauth')

  ms.client(addr, function (err, stream) {
    t.ok(err)
    console.log('client', stream)
    t.end()
    close()
  })
})

tape('ws~noauth', function (t) {
  var ms = MultiServer([
    Compose([Ws({port: 2349, host:'localhost'}), NoAuth({})])
  ])

  var close = ms.server(function (stream) {
    stream.source(true, function () {})
  })

  var addr = ms.stringify()
  console.log('address', addr)
//  t.equal(addr, 'unix:/tmp/test_multiserver_noauth~noauth')

  ms.client(addr, function (err, stream) {
    t.ok(err)
    console.log('client', stream)
  })
})







