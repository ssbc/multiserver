
var tape = require('tape')
var pull = require('pull-stream')
var Pushable = require('pull-pushable')

var Multiserver = require('../')
var Net = require('../protocols/net')
var WS = require('../protocols/ws')

var ms = Multiserver([Net(), WS()])
var close

tape('create server', function (t) {

  close = ms.createServer(
    [
      {protocol:'net', port: 1234},
      {protocol:'ws', port:1235}
    ],
    function (stream) {
      pull(stream, stream) //echo
    })

  t.end()
})

tape('connect: net', function (t) {
  ms.connect({protocol:'net', port:1234}, function (err, stream) {
    if(err) throw err
    console.log(err, stream)
    pull(
      pull.values([new Buffer('HELLO WORLD')]),
      stream,
      pull.through(console.log),
      pull.collect(function (err, ary) {
        if(err) throw err
        t.deepEqual(Buffer.concat(ary), new Buffer('HELLO WORLD'))
        t.end()
      })
    )
  })
})

tape('connect: ws', function (t) {
  ms.connect(/*{protocol:'ws', port:1234}*/
    'ws://localhost:1235', function (err, stream) {
    if(err) throw err
    //websockets don't have halfduplex support
    //so you need to add a goodbye to your protocol.
    //see pull-goodbye module.
    var p = Pushable()
    p.push(new Buffer('HELLO WORLD'))
    pull(
      p,
      pull.through(console.log),
      stream,
      pull.through(function () {
        p.end()
      }),
      pull.collect(function (err, ary) {
        if(err) throw err
        t.deepEqual(Buffer.concat(ary), new Buffer('HELLO WORLD'))
        t.end()
      })
    )
  })
})


tape('connect error: net', function (t) {
  ms.connect({protocol: 'net', port: 9876},
    function (err, stream) {
      t.ok(err)
      t.notOk(stream)
      t.end()
    })
})


tape('connect error: ws', function (t) {

  ms.connect('ws://localhost:9934',
    function (err, stream) {
      t.ok(err)
      t.notOk(stream)
      t.end()
    })
})


tape('close', function (t) {
  close()
  t.end()
})

/*
<domain>:{{1235:ws,1234:net}key:WEAK, {2345:ws,2346:net}:key:STRONG}
{{domain:PORT:PROTO:SEC:key}(P,net,STRONG)(P+1,net,WEAK)}(1234, WEAK)(1246, STRONG)(2345,net,STRONG)(2346,net,STRONG)

(net:domain:port)(shs:key)
(ws:domain:port)(shs2:key)
*/

