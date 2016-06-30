var zlib = require('zlib')
var toPull = require('stream-to-pull-stream')
var pull = require('pull-stream')

function createGzip () {
  return toPull.transform(zlib.createGzip())
}
function createGunzip () {
  return toPull.transform(zlib.createGunzip())
}

module.exports = function gzip () {
  return function (stream,  cb) {
    cb(null, {
      source: pull(stream.source, createGunzip()),
      sink: pull(createGzip(), stream.sink)
    })

  }
}





