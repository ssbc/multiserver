# multiserver

A single interface that can work with multiple protocols,
and multilpe transforms of those protocols (eg, security layer)

## motivation

developing a p2p system is hard. especially hard is upgrading protocol layers.
The contemporary approach is to [update code via a backdoor](https://whispersystems.org/blog/the-ecosystem-is-moving/),
but as easily as security can be added, it can be taken away. We need an approach
to upgrading that is itself decentralized, and also does not accumulate legacy baggage.
after upgrading past a version of the protocol, the system should be able to discard that
without a trace.

Traditionally, protocol versions are upgraded by negioating the version used in a handshake.
But how do you upgrade the handshake? you can't. This also tends to accumulate legacy, because
you never know if you'll meet an old peer.

Some http apis provide upgradability a better, simpler way.
by putting a version number within the url. A new version of
the api can then be used without touching the old one at all.

I propose to adapt this approach to lower level protocols.
Do not negioate versions/ciphersuits in the handshake.
instead, run multiple protocols at once, and "lookup" which
versions a peer supports currently. Most p2p systems have
some sort of lookup system to find peers _anyway_
(might be DHT, a tracker server, or gossip),
just put version information in there.

There are two main situations where I expect this to be useful,
upgrading ciphers, and bridging across enviroments that are
otherwise cannot talk to each other (web browser to desktop)

### upgrade

If a peer wants to upgrade from *weak* protocol
to a *strong* one, they simply start serving *strong* via another port,
and advertise that in the lookup system.
Now peers that have support for *strong* can connect via that protocol.

Once most peers have upgraded to strong, support for *weak* can be discontinued.

### bridging

regular servers can do tcp. desktop clients can speak tcp,
but can't create tcp servers reliably. browsers can
use websockets and webrtc. webrtc gives you p2p, but
needs an introducer. another option is [utp](https://github.com/mafintosh/utp-native)
- probably the most convienent, because it doesn't need an introducer
on _every connection_ (but it does require some bootstrapping),
but that doesn't work in the browser either.

Also, other times, there are different types of peers that may prefer different protocols
for non security reasons. servers with stable IP addresses can use TCP, but your laptop
probably needs . Browser clients don't
have those options, but they can use webrtc and websockets.


``` js
var MultiServer = require('multiserver')

var ms = MultiServer([
  require('multiserver/plugs/net')({port: 1234}),
  require('multiserver/plugs/ws')({port: 2345})
])

//start a server (for both protocols!)
//returns function to close the server.
var close = ms.server(function (stream) {
  //handle incoming connection
})

//connect to a protocol. uses whichever
//handler understands the address (in this case, websockets)
ms.client('ws://localhost:1234', function (err, stream) {
  //...
})
```

### example - server with two security protocols

This is just how some services (eg, github) have an api version
in their URL scheme. It is now easy to use two different
versions in parallel. later, they can close down the old api.
``` js
var MultiServer = require('multiserver')
var ms = MultiServer([
  [ //net + secret-handshake
    require('multiserver/plugs/net')({port: 3333}),
    require('secret-handshake-multiserver')({
      keys: //keypair
      appKey: //application key
      auth: //auth function (only needed for server)
    }),
  ],
  [ //net + secret-handshake2
    //(not implemented yet, but incompatible with shs)
    require('multiserver/plugs/net')({port: 4444}),
    require('secret-handshake2-multiserver')({
      keys: //keypair
      appKey: //application key
      auth: //auth function (only needed for server)
    }),
  ]
]

console.log(ms.stringify())

//=> net:<host>:3333~shs:<key>;net:<host>:4444~shs2:<key>

//run two servers on two ports.
//newer peers can connect directly to 4444 and use shs2.
//this means the protocol can be _completely_ upgraded.
ms.server(function (stream) {

})

//connect to legacy protocol
ms.client('net:<host>:3333~shs:<key>', function (err, stream) {
  //...
})

//connect to modern protocol
ms.client('net:<host>:4444~shs2:<key>', function (err, stream) {
  //...
})

```

## License

MIT









