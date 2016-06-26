# multiserver

A single interface that can work with multiple protocols at once.

## motivation

developing a p2p system is hard. especially hard is upgrading the protocol.
The contemporary approach is to [update code via a backdoor](https://whispersystems.org/blog/the-ecosystem-is-moving/),
but as easily as security can be added, it can be taken away. We need an approach
to upgrading that is itself decentralized, and also does not accumulate legacy baggage.
after upgrading past a version of the protocol, the system should be able to discard that
without a trace.

Traditionally, protocol versions are upgraded by negioating the version used in a handshake.
But how do you upgrade the handshake? you can't. This also tends to accumulate legacy, because
you never know if you'll meet an old peer.

I propose a new approach. Do not negioate versions/ciphersuits in the handshake. P2P systems
usually have a look up system to find other peers (this might be DHT, a server, or gossip).
We can leverage this to negioate versions. If a peer wants to upgrade from *weak* protocol
to a *strong* one, they simply start serving *strong* via another port, and advertise that
in the lookup system. Now peers that have support for *strong* can connect via that protocol.

Once most peers have upgraded to strong, support for *weak* can be discontinued.

Also, other times, there are different types of peers that may prefer different protocols
for non security reasons. servers with stable IP addresses can use TCP, but your laptop
probably needs [utp](https://github.com/mafintosh/utp-native). Browser clients don't
have those options, but they can use webrtc and websockets.

---

so we have protocols, like (tcp, ws, tor, utp, webrtc).
and then we _also_ have security protocols, often,
these wrap a specific network protocol, which makes them inflexible,
but really, they could be implemented as duplex transforms,
https://github.com/auditdrivencrypto/secret-handshake/

you connect to a peer over a raw, then wrap the security layer.
you could represent this as a composition!
`net:<host>:<port>|shs:<key>`

remember, these are duplex streams, so `shs` would wrap `net`.
It may help to think of it like:

`shs(net(<host>:<port>), <key>)`

another example would be to use compression.

`net:<host>:<port>|shs:<key>|gzip`

now we have added compression on the inside of the encryption.

> NOTE: I am still deciding what the syntax for representing addresses are.

## example - server with net and ws

create a server that listens on tcp and websockets,
then create a client that connects to the websocket interface.

``` js
var handers = [
  require('multiserver/protocols/net'),
  require('multiserver/protocols/ws')
]
var MultiServer = require('multiserver')(handlers)

MultiServer.createServer([
  {protocol:'ws', port: 1234},
  {protocol:'net', port: 2345}
], function (stream) {
  //handle incoming connection
})

MultiServer.connect({protocol:'ws', port: 1234}, function (err, stream) {
  //...
})
```

### example - server with two security protocols

> not implemented yet

``` js
var handers = [
  require('multiserver/protocols/net'),
  require('secret-handshake/multiserver')
  require('secret-handshake2/multiserver')
]
var MultiServer = require('multiserver')(handlers)

MultiServer.createServer([
  [{protocol:'net', port: 3001}, {protocol: 'shs', keys: <key>}],
  [{protocol:'net', port: 3002}, {protocol: 'shs2', keys: <keys>}]
], function (stream) {

})

MultiServer.connect(  [
  {protocol:'net', port: 3002}, //connect to this port
  {protocol: 'shs2', key: <key>} //then use this encryption protocol.
], function (err, stream) {
  //...
})
```

## License

MIT



