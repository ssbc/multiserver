var tape = require('tape')
var pull = require('pull-stream')
var Pushable = require('pull-pushable')

var Compose = require('../compose')
var Net = require('../plugins/net')
var Ws = require('../plugins/ws')
var Shs = require('../plugins/shs')

var cl = require('chloride')
var seed = cl.crypto_hash_sha256(new Buffer('TESTSEED'))
var keys = cl.crypto_sign_seed_keypair(seed)
var appKey = cl.crypto_hash_sha256(new Buffer('TEST'))

var requested, ts

//this gets overwritten in the last test.
var check = function (id, cb) {
  cb(null, true)
}

var net = Net({port: 4848})
var ws = Ws({port: 4848})
var shs = Shs({keys: keys, appKey: appKey, auth: function (id, cb) {
  requested = id
  ts = Date.now()

  check(id, cb)
}})

var combined = Compose([net, shs])
var combined_ws = Compose([ws, shs])

tape('parse, stringify', function (t) {

  t.equal(
    net.stringify(),
    'net:localhost:4848'
  )
  t.equal(
    ws.stringify(),
    'ws://localhost:4848'
  )
  t.equal(
    shs.stringify(),
    'shs:' + keys.publicKey.toString('base64')
  )
  t.equal(
    combined.stringify(),
    net.stringify()+'~'+shs.stringify()
  )
  t.equal(
    combined_ws.stringify(),
    ws.stringify()+'~'+shs.stringify()
  )
  console.log(Compose([net, shs]).stringify())
  t.end()
})

function echo (stream) {
  pull(
    stream,
    pull.map(function (data) {
      return new Buffer(data.toString().toUpperCase())
    }),
    stream
  )
}

tape('combined', function (t) {
  var close = combined.server(echo)

  combined.client(combined.stringify(), function (err, stream) {
    if(err) throw err
    pull(
      pull.values([new Buffer('hello world')]),
      stream,
      pull.collect(function (err, ary) {
        if(err) throw err
        t.equal(Buffer.concat(ary).toString(), 'HELLO WORLD')
        t.end()
        close()
      })
    )
  })
})

tape('ws with combined', function (t) {
  var close = combined_ws.server(echo)

  combined_ws.client(combined_ws.stringify(), function (err, stream) {
    if(err) throw err
    var pushable = Pushable()
    pushable.push(new Buffer('hello world'))
    pull(
      pushable,
      stream,
      pull.through(function () {
        pushable.end()
      }),
      pull.collect(function (err, ary) {
        t.equal(Buffer.concat(ary).toString(), 'HELLO WORLD')
        t.end()
        close()
      })
    )
  })
})

tape('error if try to connect on wrong protocol', function (t) {

  t.equal(combined_ws.parse(combined.stringify()), null)

  combined_ws.client(combined.stringify(), function (err, stream) {
    t.ok(err)
    t.end()
  })
})

tape('shs with seed', function (t) {

  var close = combined.server(echo)

  var seed = cl.crypto_hash_sha256(new Buffer('TEST SEED'))
  var bob = cl.crypto_sign_seed_keypair(seed)

  var checked
  check = function (id, cb) {
    console.log("REQUEST AUTH", id)
    checked = id
    if(id.toString('base64') === bob.publicKey.toString('base64'))
      cb(null, true)
    else
      cb(null, false)
  }

  var addr_with_seed = combined.stringify()+':'+seed.toString('base64')

  console.log(addr_with_seed)

  combined.client(addr_with_seed, function (err, stream) {
    t.notOk(err)
    t.deepEqual(checked, bob.publicKey)
    t.end()
    stream.source(true, function () {})
    close()
  })

})



