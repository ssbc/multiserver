var test = require('tape')
var Ms = require('../')

function sync_server(t) {
  return {
    server: function() {
      return function close() {
        t.pass('sync close')
      }
    }
  }
}

function async_server(t) {
  return {
    server: function() {
      return function close(cb) {
        setTimeout(function() {
          t.comment('async close')
          t.async_calls = (t.async_calls || 0) + 1
          cb(null)
        }, 100)
      }
    }
  }
}

test('all calls are sync', function(t) {
  var ms = Ms([
    sync_server(t),
    sync_server(t)
  ])
  var close = ms.server()
  t.plan(2)
  close()
})

test('all calls are async', function(t) {
  var ms = Ms([
    async_server(t),
    async_server(t)
  ])
  var close = ms.server()
  close(function(err) {
    t.error(err)
    t.equal(t.async_calls, 2, 'Should have waited for both servers')
    t.end()
  })
})

test.only('async caller, sync callee', function(t) {
  var ms = Ms([
    sync_server(t),
    sync_server(t)
  ])
  var close = ms.server()
  close(function(err) {
    t.error(err)
    t.end()
  })
})

test('all calls are async', function(t) {
  var ms = Ms([
    async_server(t),
    async_server(t)
  ])
  var close = ms.server()
  close(function(err) {
    t.error(err)
    t.equal(t.async_calls, 2, 'Should have waited for both servers')
    t.end()
  })
})

test('async caller, mixed callees', function(t) {
  var ms = Ms([
    sync_server(t),
    async_server(t)
  ])
  var close = ms.server()
  t.plan(3)
  close(function(err) {
    t.error(err)
    t.equal(t.async_calls, 1, 'Should have waited for async servers')
  })
})
