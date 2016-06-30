
var chloride = require('chloride')
var pull = require('pull-stream')
var tape = require('tape')
var MultiServer = require('../')
var Net = require('../protocols/net')
var Ws = require('../protocols/ws')
var Shs = require('../transforms/shs')

var alice = chloride.crypto_sign_keypair()
var bob = chloride.crypto_sign_keypair()
var app_key = chloride.crypto_hash_sha256(new Buffer('TEST'))

function party (id, cb) {
  if(id.toString('hex') === bob.publicKey.toString('hex'))
    cb(null, true)
  else
    cb(null, false)
}

var serverA = MultiServer([
  Net(),
  Ws(),
  Shs(alice, app_key, 1000, party)
])

var serverB = MultiServer([
  Net(),
  Ws(),
  Shs(bob, app_key, 1000, party)
])


tape('simple - shs', function (t) {

  var close = serverA.createServer([
    [{protocol: 'net', port: 8989}, {protocol: 'shs'}],
    [{protocol: 'ws', port: 8990}, {protocol: 'shs'}]
  ], function (stream) {
    console.log('CONNECT', stream)
    pull(stream, pull.map(function (e) {
      return new Buffer(e.toString().toUpperCase())
    }), stream)
  })

  serverB.connect([{
    protocol: 'net', port:8989
  }, {
    protocol: 'shs', key: alice.publicKey
  }], function (err, stream) {
    if(err) throw err
    pull(
      pull.values([new Buffer('hello world')]),
      stream,
      pull.collect(function (err, ary) {
        console.log('CONNECTED', ary)
        console.log(err, ary)
        t.deepEqual(Buffer.concat(ary), new Buffer('HELLO WORLD'))
        t.end()
        close()
      })
    )
  })
})


