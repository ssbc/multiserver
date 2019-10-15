var fs = require('fs')
var tape = require('tape')
var pull = require('pull-stream')
var Pushable = require('pull-pushable')
var scopes = require('multiserver-scopes')

var Compose = require('../compose')
var Net = require('../plugins/net')
var Unix = require('../plugins/unix-socket')
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

//var net = Net({port: 4848, scope: 'device'})
var net = Net({port: 4848})
var ws = Ws({port: 4848})
var shs = Shs({keys: keys, appKey: appKey, auth: function (id, cb) {
  requested = id
  ts = Date.now()

  check(id, cb)
}})

var combined = Compose([net, shs])
var combined_ws = Compose([ws, shs])

// travis currently does not support ipv6, becaue GCE does not.
var has_ipv6 = process.env.TRAVIS === undefined

tape('parse, stringify', function (t) {

  t.equal(
    net.stringify('device'),
    'net:localhost:4848'
  )
  t.equal(
    ws.stringify('device'),
    'ws://localhost:4848'
  )
  t.equal(
    shs.stringify(),
    'shs:' + keys.publicKey.toString('base64')
  )
  t.equal(
    combined.stringify('device'),
    net.stringify('device')+'~'+shs.stringify('device')
  )
  t.equal(
    combined_ws.stringify('device'),
    ws.stringify()+'~'+shs.stringify()
  )
  console.log(Compose([net, shs]).stringify('device'))
  t.equal(
    MultiServer([combined, combined_ws]).stringify(),

    [combined.stringify('device'), combined_ws.stringify('device')].join(';')
  )

  t.end()
})

function echo (stream) {
  pull(
    stream,
    pull.map(function (data) {
      return Buffer.from(data.toString().toUpperCase())
    }),
    stream
  )
}

tape('combined', function (t) {
  var close = combined.server(echo)

  combined.client(combined.stringify('device'), function (err, stream) {
    if(err) throw err
    pull(
      pull.values([Buffer.from('hello world')]),
      stream,
      pull.collect(function (err, ary) {
        if(err) throw err
        t.equal(Buffer.concat(ary).toString(), 'HELLO WORLD')
        close(function() {t.end()})
      })
    )
  })
})

if (has_ipv6)
tape('combined, ipv6', function (t) {
  var combined = Compose([
    Net({
      port: 4848,
      host: '::'
    }),
    shs
  ])
  var close = combined.server(echo)
  var addr = combined.stringify('device')
  console.log('addr', addr)


  combined.client(addr, function (err, stream) {
    if(err) throw err
    t.ok(stream.address, 'has an address')
    pull(
      pull.values([Buffer.from('hello world')]),
      stream,
      pull.collect(function (err, ary) {
        if(err) throw err
        t.equal(Buffer.concat(ary).toString(), 'HELLO WORLD')
        close(function() {t.end()})
      })
    )
  })
})

if (has_ipv6)
tape('stringify() does not show scopeid from ipv6', function (t) {
  var combined = Compose([
    Net({
      scope: 'private',
      port: 4848,
      host: 'fe80::1065:74a4:4016:6266%wlan0'
    }),
    shs
  ])
  var addr = combined.stringify('private')
  t.equal(
    addr,
    'net:fe80::1065:74a4:4016:6266:4848~shs:' +
    keys.publicKey.toString('base64')
  )
  t.end()
})

tape('net: do not listen on all addresses', function (t) {
  var combined = Compose([
    Net({
      scope: 'device',
      port: 4848,
      host: 'localhost',
//      external: scopes.host('private') // unroutable IP, but not localhost (e.g. 192.168 ...)
    }),
    shs
  ])
  var close = combined.server(echo)

  //fake
  var fake_combined = Compose([
    Net({
      scope: 'local',
      port: 4848,
      //host: 'localhost',
//      external: scopes.host('local') // unroutable IP, but not localhost (e.g. 192.168 ...)
    }),
    shs
  ])

  var addr = fake_combined.stringify('local') // returns external
  console.log('addr local scope', addr)
  combined.client(addr, function (err, stream) {
    t.ok(err, 'should only listen on localhost')
    close(function() {t.end()})
  })
})

tape('net: do not crash if listen() fails', function(t) {
  var combined = Compose([
    Net({
      scope: 'private',
      port: 4848,
      host: '$not-a-valid-ip-addr$',
    }),
    shs
  ])
  var close = combined.server(echo, function() {}, function(err) {
    t.ok(err, 'should propagate listen error up')
    t.equal(err.code, 'ENOTFOUND', 'the error is expected')
    close(function() {t.end()})
  })
})

tape('combined, unix', function (t) {
  var p = 'multiunixtest'+(new Date()).getTime()
  fs.mkdirSync(p)
  var combined = Compose([
    Unix({
      server: true,
      path: p,
    }),
    shs
  ])
  var close = combined.server(echo)
  var addr = combined.stringify('device')
  console.log('unix addr', addr)

  combined.client(addr, function (err, stream) {
    if(err) throw err
    t.ok(stream.address, 'has an address')
    pull(
      pull.values([Buffer.from('hello world')]),
      stream,
      pull.collect(function (err, ary) {
        if(err) throw err
        t.equal(Buffer.concat(ary).toString(), 'HELLO WORLD')
        close(function() {
          fs.rmdirSync(p)
          t.end()
        })
      })
    )
  })
})

tape('ws with combined', function (t) {
  var close = combined_ws.server(function (stream) {
    console.log('combined_ws address', stream.address)
    t.ok(stream.address, 'has an address')
    echo(stream)
  }, null, function () {

    combined_ws.client(combined_ws.stringify(), function (err, stream) {
      if(err) throw err
      t.ok(stream.address, 'has an address')
      console.log('combined_ws address', stream.address)
      var pushable = Pushable()
      pushable.push(Buffer.from('hello world'))
      pull(
        pushable,
        stream,
        pull.through(function () {
          pushable.end()
        }),
        pull.collect(function (err, ary) {
          t.equal(Buffer.concat(ary).toString(), 'HELLO WORLD')
          close(function() {t.end()})
        })
      )
    })
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

  var seed = cl.crypto_hash_sha256(Buffer.from('TEST SEED'))
  var bob = cl.crypto_sign_seed_keypair(seed)

  var checked
  check = function (id, cb) {
    checked = id
    if(id.toString('base64') === bob.publicKey.toString('base64'))
      cb(null, true)
    else
      cb(null, false)
  }

  var addr_with_seed = combined.stringify()+':'+seed.toString('base64')

  combined.client(addr_with_seed, function (err, stream) {
    t.notOk(err)
    t.deepEqual(checked, bob.publicKey)
    stream.source(true, function () {})
    close(function() {t.end()})
  })

})

tape('ws default port', function (t) {
  var ws = Ws({
    external: 'domain.de',
    scope: 'public',
    server: {
      key: null,
      address: function () { return {port: 80}}
    }})
  t.equal(ws.stringify('public'), 'ws://domain.de')
  t.equal(ws.stringify('local'), null)
  t.equal(ws.stringify('device'), null)
  t.end()
})


tape('wss default port', function (t) {
  var ws = Ws({
    external: 'domain.de',
    scope: 'public',
    server: {
      key: true,
      address: function () { return {port: 443}}
    }})
  t.equal(ws.stringify('public'), 'wss://domain.de')
  t.equal(ws.stringify('local'), null)
  t.equal(ws.stringify('device'), null)
  t.end()
})

tape('wss with key and cert', function (t) {
  var ws = Ws({
    external: 'domain.de',
    scope: 'public',
    key: 'path',
    cert: 'path'
  })
  t.equal(ws.stringify('public'), 'wss://domain.de')
  t.equal(ws.stringify('local'), null)
  t.equal(ws.stringify('device'), null)
  t.end()
})

var onion = Onion({scope: 'public'})

tape('onion plug', function (t) {

  // onion has no server
  t.equal(onion.stringify('public'), null)
  t.equal(onion.stringify('device'), null)
  t.equal(onion.stringify('local'), null)

  t.deepEqual(
    onion.parse('onion:3234j5sv346bpih2.onion:2349'),
    {
      name: 'onion',
      host: '3234j5sv346bpih2.onion',
      port: 2349
    }
  )

  var oshs = Compose([onion, shs])

  //should not return an address
  t.notOk(oshs.stringify())

  t.end()
})

tape('id of stream from server', function (t) {
  check = function (id, cb) {
    cb(null, true)
  }
  var close = combined.server(function (stream) {
    var addr = combined.parse(stream.address)
    t.ok(addr)
    console.log('address as seen on server', addr)
    t.equal(addr[0].name, 'net')
    t.deepEqual(addr[1], combined.parse(combined.stringify())[1])

    pull(stream.source, stream.sink) //echo
  }, function (err) {
    if(err) throw err
  }, function () {

    combined.client(combined.stringify(), function (err, stream) {
      if(err) throw err
      var addr = combined.parse(stream.address)
      t.equal(addr[0].name, 'net')
      t.equal(addr[0].port, 4848)
      t.deepEqual(addr[1], combined.parse(combined.stringify())[1])
      stream.source(true, function () {
        close(function() {t.end()})
      })
    })
  })
})

function testAbort (name, combined) {

  tape(name+', aborted', function (t) {
    var close = combined.server(function onConnection() {
      throw new Error('should never happen')
    })

    var abort = combined.client(combined.stringify(), function (err, stream) {
      t.ok(err)

      // NOTE: without the timeout, we try to close the server
      // before it actually started listening, which fails and then
      // the server keeps runnung, causing the next test to fail with EADDRINUSE
      //
      // This is messy, combined.server should be a proper async call
      setTimeout( function() {
        console.log('Calling close')
        close(function() {t.end()})
      }, 500)
    })

    abort()

  })
}

testAbort('combined', combined)
testAbort('combined.ws', combined_ws)

tape('error should have client address on it', function (t) {
//  return t.end()
  check = function (id, cb) {
    throw new Error('should never happen')
  }
  var close = combined.server(function (stream) {
    throw new Error('should never happen')
  }, function (err) {
    var addr = err.address
    t.ok(/^net\:/.test(err.address))
    t.ok(/\~shs\:/.test(err.address))
    //the shs address won't actually parse, because it doesn't have the key in it
    //because the key is not known in a wrong number.
  }, function () {

    //very unlikely this is the address, which will give a wrong number at the server.
    var addr = combined.stringify().replace(/shs:......../, 'shs:XXXXXXXX')
    combined.client(addr, function (err, stream) {
      //client should see client auth rejected
      t.ok(err)
      console.log('Calling close')
      close() // in this case, net.server.close(cb) never calls its cb, why?
      t.end()
    })
  })
})

tape('multiple public different hosts', function(t) {
  var net1 = Net({ host: '127.0.0.1', port: 4848, scope: 'public'})
  var net2 = Net({ host: '::1', port: 4847, scope: 'public'})

  var combined1 = Compose([net1, shs])
  var combined2 = Compose([net2, shs])

  t.equal(
    MultiServer([combined1, combined2]).stringify('public'),
    [combined1.stringify('public'), combined2.stringify('public')].join(';')
  )

  t.end()
})

tape('multiple scopes different hosts', function(t) {
  var net1 = Net({ host: '127.0.0.1', port: 4848, scope: ['local', 'device', 'public']})
  var net2 = Net({ host: '::1', port: 4847, scope: ['local', 'device', 'public']})

  var combined1 = Compose([net1, shs])
  var combined2 = Compose([net2, shs])

  t.equal(
    MultiServer([combined1, combined2]).stringify('public'),
    [combined1.stringify('public'), combined2.stringify('public')].join(';')
  )

  t.end()
})
