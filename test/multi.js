const tape = require('tape')
const pull = require('pull-stream')

const Compose = require('../compose')
const Net = require('../plugins/net')
const Ws = require('../plugins/ws')
const Shs = require('../plugins/shs')
const MultiServer = require('../')

const cl = require('chloride')
const seed = cl.crypto_hash_sha256(Buffer.from('TESTSEED'))
const keys = cl.crypto_sign_seed_keypair(seed)
const appKey = cl.crypto_hash_sha256(Buffer.from('TEST'))

// this gets overwritten in the last test.
let check = function (id, cb) {
  cb(null, true)
}

const net = Net({ port: 4848, scope: 'device' })
const ws = Ws({ port: 4849, scope: 'device' })
//console.log('appKey', appKey)
const shs = Shs({
  keys: keys,
  appKey: appKey,
  auth: function (id, cb) {
    check(id, cb)
  },
})

const combined = Compose([net, shs])
const combined_ws = Compose([ws, shs])

const multi = MultiServer([combined, combined_ws])

const multi_ws = MultiServer([combined_ws])
const multi_net = MultiServer([combined])

let client_addr

let close

//listen, with new async interface
tape('listen', function (t) {
  close = multi.server(
    function (stream) {
      console.log('onConnect', stream.address)
      client_addr = stream.address
      pull(stream, stream)
    },
    null,
    t.end
  )
})

const server_addr = 'fake:peer.ignore~nul:what;' + multi.stringify('device')
//"fake" in a unkown protocol, just to make sure it gets skipped.

tape('connect to either server (net)', function (t) {
  t.ok(multi.stringify('device'))
  multi.client(server_addr, function (err, stream) {
    if (err) throw err
    //console.log(stream)
    t.ok(/^net/.test(client_addr), 'client connected via net')
    t.ok(/^net/.test(stream.address), 'client connected via net')
    pull(
      pull.values([Buffer.from('Hello')]),
      stream,
      pull.collect(function (err, ary) {
        const data = Buffer.concat(ary).toString('utf8')
        console.log('OUTPUT', data)
        t.end()
      })
    )
  })
})

tape('connect to either server (ws)', function (t) {
  multi_ws.client(server_addr, function (err, stream) {
    if (err) throw err
    t.ok(/^ws/.test(client_addr), 'client connected via ws')
    t.ok(/^ws/.test(stream.address), 'client connected via ws')
    pull(
      pull.values([Buffer.from('Hello')]),
      stream,
      pull.collect(function (err, ary) {
        const data = Buffer.concat(ary).toString('utf8')
        console.log('OUTPUT', data)
        t.end()
      })
    )
  })
})

tape('close', function (t) {
  close()
  t.end()
})
