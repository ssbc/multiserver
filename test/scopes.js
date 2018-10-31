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
var seed1 = cl.crypto_hash_sha256(Buffer.from('TESTSEED'))
var seed2 = cl.crypto_hash_sha256(Buffer.from('TESTSEED'))
var keys1 = cl.crypto_sign_seed_keypair(seed1)
var keys2 = cl.crypto_sign_seed_keypair(seed2)
var appKey = cl.crypto_hash_sha256(Buffer.from('TEST'))

var requested, ts

//this gets overwritten in the last test.
var check = function (id, cb) {
  cb(null, true)
}

var net_local = Net({port: 4848, scope: 'local'})
var net_device = Net({port: 4848, scope: 'device'})

function allow (id, cb) { cb(null, true) }
var shs = Shs({keys: keys1, appKey: appKey, auth: allow})

var device = Compose([net_device, shs])
var local = Compose([net_local, shs])
var multi = MultiServer([ device, local ])
var local_device = Net({port: 4848, scope: ['local', 'device']})
var multi2 = MultiServer([[local_device, shs]])

tape('local and device are two addresses', function (t) {
  t.ok(/localhost/.test(multi.stringify('device')))
  t.ok(/192\.168\.\d+\d+/.test(multi.stringify('local')))
  t.end()
})

var close


function connect (multi, name) {
  tape(name+'.server', function (t) {
    close = multi.server(function (stream) {
      console.log('stream', stream.address)
      stream.source(true, function () {})
    })
    t.end()
  })

  tape(name+'.client - device', function (t) {
    multi.client(multi.stringify('device'), function (err) {
      if(err) throw err
      t.end()
    })
  })

  tape(name+'.client - local', function (t) {
    multi.client(multi.stringify('local'), function (err) {
      if(err) throw err
      t.end()
    })
  })
  tape('close', function (t) {
    close(t.end)
  })

}
connect(multi, 'multi')

tape('double', function (t) {
  //var net_local_device = 
  console.log(multi2.stringify('local'))
  t.ok(/localhost/.test(multi2.stringify('device')))
  t.ok(/192\.168\.\d+\d+/.test(multi2.stringify('local')))
  t.equal(multi2.stringify('local'), multi.stringify('local'))
  t.equal(multi2.stringify('device'), multi.stringify('device'))
  t.end()
})

connect(multi2, 'multi2')


return
var multi_ws = MultiServer([ combined_ws ])
var multi_net = MultiServer([ combined ])

var client_addr

var close = multi.server(function (stream) {
  console.log("onConnect", stream.address)
  client_addr = stream.address
  pull(stream, stream)
})

var server_addr =
'fake:peer.ignore~nul:what;'+multi.stringify()
//"fake" in a unkown protocol, just to make sure it gets skipped.

tape('connect to either server', function (t) {

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
//        close()
        t.end()
      })
    )
  })
})

tape('connect to either server', function (t) {

  console.log(multi.stringify())

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

































