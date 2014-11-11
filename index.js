
var EventEmitter = require('events').EventEmitter
var pull = require('pull-stream')

var protocols = {
  tcp: require('./plugins/net'),
  ws: require('./plugins/ws')
}

exports.createServer = function (onConnection) {

  var emitter = new EventEmitter()

  emitter.servers = []

  emitter.listen = function (desc, cb) {

    desc.forEach(function (s) {
      console.log('attempt opening:', s)
      var desc = s[0]
      var network = protocols[desc[0]] //the bottom layer
      if(!network) return console.log('unknown protocol:', desc[0])
      var server = network.createServer()
      server.parent = emitter
      var args = desc.slice(1)
      args.push(function () {
        console.log('listening on', desc)
      })
      server.on('connection', function (stream, type) {
        console.log('con', type, desc)
        emitter.emit('connection', stream, type || desc[0])
      })
      server.listen.apply(server, args)
      server.descriptor = desc
    })
  }

  if(onConnection) emitter.on('connection', onConnection)

  return emitter
}

exports.connect = function (opts) {

}

if(!module.parent) {
  exports.createServer(function (s, type) {
    console.log(type, 'connection')
    pull(
      s.source,
      pull.through(function (d) { console.log(d.toString()) }),
      s.sink
    )
  }).listen([
    [['tcp', 8000]],
    [['ws', 8001]]
  ])
}
