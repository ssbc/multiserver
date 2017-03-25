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


tape('combined, ipv6', function (t) {
  var close = combined.server(echo)

  var addr = combined.stringify().replace('localhost', '::1')

  combined.client(addr, function (err, stream) {
    if(err) throw err
    t.ok(stream.address, 'has an address')
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
  var close = combined_ws.server(function (stream) {
    console.log('combined_ws address', stream.address)
    t.ok(stream.address, 'has an address')
    echo(stream)
  })

  combined_ws.client(combined_ws.stringify(), function (err, stream) {
    if(err) throw err
    t.ok(stream.address, 'has an address')
    console.log('combined_ws address', stream.address)
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
    t.end()
    stream.source(true, function () {})
    close()
  })

})

tape('ws default port', function (t) {
  var ws = Ws({
    host: 'domain.de',
    server: {
      key: null,
      address: function () { return {port: 80}}
    }})
  t.equal(ws.stringify(), 'ws://domain.de')
  t.end()
})


tape('wss default port', function (t) {
  var ws = Ws({
    host: 'domain.de',
    server: {
      key: true,
      address: function () { return {port: 443}}
    }})
  t.equal(ws.stringify(), 'wss://domain.de')
  t.end()
})


var onion = Onion({server:false})

tape('onion plug, server false', function (t) {

  t.notOk(onion.stringify(), null)
  t.deepEqual(
    onion.parse('onion:3234j5sv346bpih2.onion:2349'),
    {
      name: 'onion',
      host: '3234j5sv346bpih2.onion',
      port: 2349
    }
  )

  var oshs = Compose([onion, shs])

  //should not return an address, since onion is server: false
  t.notOk(oshs.stringify())

  t.end()

})

tape('use server and non server and close it', function (t) {

  var ms = MultiServer([
    [net, shs],
    [onion, shs]
  ])

  var close = ms.server()

  t.equal(ms.stringify(), combined.stringify())

  close()

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
  })

  combined.client(combined.stringify(), function (err, stream) {
    if(err) throw err
    var addr = combined.parse(stream.address)
    t.equal(addr[0].name, 'net')
    t.equal(addr[0].port, 4848)
    t.deepEqual(addr[1], combined.parse(combined.stringify())[1])
    stream.source(true, function () {
      close()
      t.end()
    })
  })
})


tape('error should have client address on it', function (t) {

  check = function (id, cb) {
    throw new Error('should never happen')
  }
  var close = combined.server(function (stream) {
    throw new Error('should never happen')
  }, function (err) {
    console.log(err)
    var addr = err.address
    t.ok(/^net\:/.test(err.address))
    t.ok(/\~shs\:/.test(err.address))
    //the shs address won't actually parse, because it doesn't have the key in it
    //because the key is not known in a wrong number.
    t.end()
    close()
  })

  //very unlikely this is the address, which will give a wrong number at the server.
  var addr = combined.stringify().replace(/shs:......../, 'shs:XXXXXXXX')

  combined.client(addr, function (err, stream) {
    //client should see client auth rejected
    t.ok(err)
    close()
  })

})

