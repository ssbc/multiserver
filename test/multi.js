var tape = require('tape')
var pull = require('pull-stream')
var Pushable = require('pull-pushable')

var Compose = require('../compose')
var Net = require('../plugins/net')
var Ws = require('../plugins/ws')
var Shs = require('../plugins/shs')
var Onion = require('../plugins/onion')
var MultiServer = require('../')

var cl = require('chloride')
var seed = cl.crypto_hash_sha256(Buffer.from('TESTSEED'))
var keys = cl.crypto_sign_seed_keypair(seed)
var appKey = cl.crypto_hash_sha256(Buffer.from('TEST'))

var requested, ts

//this gets overwritten in the last test.
var check = function (id, cb) {
  cb(null, true)
}

var net = Net({port: 4848, scope: 'device'})
var ws = Ws({port: 4849, scope: 'device'})
console.log('appKey', appKey)
var shs = Shs({keys: keys, appKey: appKey, auth: function (id, cb) {
  requested = id
  ts = Date.now()

  check(id, cb)
}})

var combined = Compose([net, shs])
var combined_ws = Compose([ws, shs])

var multi = MultiServer([
  combined, combined_ws
])

var multi_ws = MultiServer([ combined_ws ])
var multi_net = MultiServer([ combined ])

var client_addr

var close

//listen, with new async interface
tape('listen', function (t) {
  close = multi.server(function (stream) {
    console.log("onConnect", stream.address)
    client_addr = stream.address
    pull(stream, stream)
  }, null, t.end)
})

var server_addr =
'fake:peer.ignore~nul:what;'+multi.stringify('device')
//"fake" in a unkown protocol, just to make sure it gets skipped.

tape('connect to either server', function (t) {
  t.ok(multi.stringify('device'))
  multi.client(server_addr, function (err, stream) {
    if(err) throw err
    console.log(stream)
    t.ok(/^net/.test(client_addr), 'client connected via net')
    t.ok(/^net/.test(stream.address), 'client connected via net')
    pull(
      pull.values([Buffer.from('Hello')]),
      stream,
      pull.collect(function (err,  ary) {
        var data = Buffer.concat(ary).toString('utf8')
        console.log("OUTPUT", data)
        t.end()
      })
    )
  })
})

tape('connect to either server', function (t) {
  multi_ws.client(server_addr, function (err, stream) {
    if(err) throw err
    t.ok(/^ws/.test(client_addr), 'client connected via ws')
    t.ok(/^ws/.test(stream.address), 'client connected via net')
    pull(
      pull.values([Buffer.from('Hello')]),
      stream,
      pull.collect(function (err,  ary) {
        var data = Buffer.concat(ary).toString('utf8')
        console.log("OUTPUT", data)
        t.end()
      })
    )
  })
})

tape('connect to either server', function (t) {
  multi_net.client(server_addr, function (err, stream) {
    if(err) throw err
    t.ok(/^net/.test(client_addr), 'client connected via net')
    t.ok(/^net/.test(stream.address), 'client connected via net')
    pull(
      pull.values([Buffer.from('Hello')]),
      stream,
      pull.collect(function (err,  ary) {
        var data = Buffer.concat(ary).toString('utf8')
        console.log("OUTPUT", data)
        t.end()
      })
    )
  })
})

tape('close', function (t) {
  close()
  t.end()
})

