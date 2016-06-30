
var tape = require('tape')
var Net = require('../protocols/net')
var GZip = require('../transforms/gzip')
var pull = require('pull-stream')
var ReadFile = require('pull-file')

var MultiServer = require('../')([Net(), GZip])

var close = MultiServer.createServer([
  [{protocol:'net', port: 9898}, {protocol: 'gzip'}]
], function (stream) {
  pull(stream, 
    pull.through(function (buf) {
      console.log(buf)
    }),
    stream)
})


MultiServer.connect([{protocol:'net', port: 9898}, {protocol: 'gzip'}],
function (err, stream) {
  if(err) throw err
  console.log(stream)
  pull(
    ReadFile(__filename),
    stream,
    pull.collect(function (err, ary) {
      if(err) throw err
      console.log('READ', Buffer.concat(ary))//.toString())
      close()
    })
  )
})

;
