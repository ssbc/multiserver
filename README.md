# multiserver

A single interface that can work with multiple protocols,
and multiple transforms of those protocols (eg, security layer)

## address format

Addresses describe everything needed to connect to a peer.
each address is divided into protocol sections separated by `~`.
Each protocol section is divided itself by `:`. A protocol section
starts with a name for that protocol, and then whatever arguments
that protocol needs.

For example, the address for my ssb pubserver is:
```
net:wx.larpa.net:8008~shs:DTNmX+4SjsgZ7xyDh5xxmNtFqa6pWi5Qtw7cE8aR9TQ=
```
That says use the `net` protocol (TCP) to connect to the domain `wx.larpa.net`
on port `8008`, and then encrypt the session using `shs` ([secret-handshake](https://github.com/auditdrivencrypto/secret-handshake))
to the public key `DTNmX+4SjsgZ7xyDh5xxmNtFqa6pWi5Qtw7cE8aR9TQ=`.

Usually, the first section is a network protocol, and the rest are transforms,
such as encryption or compression.

Multiserver makes it easy to use multiple protocols at once. For example,
my pub server _also_ supports `shs` over websockets.

So, this is another way to connect:

```
wss://wx.larpa.net~shs:DTNmX+4SjsgZ7xyDh5xxmNtFqa6pWi5Qtw7cE8aR9TQ=
```

if your server supports multiple protocols, you can concatenate addresses with `;`
and multiserver will connect to the first address it understands.

```
net:wx.larpa.net:8008~shs:DTNmX+4SjsgZ7xyDh5xxmNtFqa6pWi5Qtw7cE8aR9TQ=;wss://wx.larpa.net~shs:DTNmX+4SjsgZ7xyDh5xxmNtFqa6pWi5Qtw7cE8aR9TQ=
```
This means use net, or wss. In some contexts, you might have a peer that understands
websockets but not net (for example a browser), as long as a server speaks at least
one protocol that a peer can understand, then they can communicate.

### net

TCP is a `net:{host}:{port}` port is not optional.

### ws

WebSockets `ws://{host}:{port}?` port defaults to 80 if not provided.

WebSockets over https is `wss://{host}:{port}?` where port is
443 if not provided.

### onion

Connect over tor using local proxy (9050). Onion is `onion:{host}:{port}` port is not optional.

### bluetooth

The [multiserver-bluetooth](https://github.com/Happy0/multiserver-bluetooth) module implements a multiserver protocol for to communicate over Bluetooth Serial port.

### reactnative-channel

The [multiserver-rn-channel](http://npm.im/multiserver-rn-channel) module implementes
a multiserver protocol for use inbetween the reactnative nodejs process and browser process.

### shs

Secret-handshake is `shs:{public_key}:{seed}?`. `seed` is used to create
a one-time shared private key, that may enable a special access.
For example, you'll see that ssb invite codes have shs with two sections
following. Normally, only a single argument (the remote public key) is necessary.

### combined

a network protocol is combined with 1 or more transform protocols,
for example: `net:{host}:{port}~shs:{key}`

### multi

A server that runs multiple protocols on different ports can simply join them
with `;` and clients should connect to their preferred protocol.
clients may try multiple protocols on the same server before giving up,
but generally it's unlikely that protocols should not fail independently
(unless there is a bug in one protocol).

an example of a valid multiprotocol:
`net:{host}:{port}~shs:{key};ws:{host}:{port}~shs:{key}`



### TODO

A short list of other protocols which could be implemented:

* cjdns
* other encryption protocols...

## motivation

Developing a p2p system is hard. especially hard is upgrading protocol layers.
The contemporary approach is to [update code via a backdoor](https://whispersystems.org/blog/the-ecosystem-is-moving/),
but as easily as security can be added, it can be taken away. We need an approach
to upgrading that is itself decentralized, and also does not accumulate legacy baggage.
after upgrading past a version of the protocol, the system should be able to discard that
without a trace.

Traditionally, protocol versions are upgraded by negioating the version used in a handshake.
But, how do you upgrade the handshake? You can't. This also tends to accumulate legacy, because
you never know if you'll meet an old peer.

Some HTTP APIs provide upgradability a better, simpler way.
By putting a version number within the url. A new version of
the API can then be used without touching the old one at all.

I propose to adapt this approach to lower level protocols.
Do not negioate versions/ciphersuits in the handshake.
Instead, run multiple protocols at once, and "lookup" which
versions a peer supports currently. Most p2p systems have
some sort of lookup system to find peers _anyway_
(might be DHT, a tracker server, or gossip),
just put version information in there.

There are two main situations where I expect this to be useful:
upgrading ciphers and bridging across enviroments that are
otherwise cannot talk to each other (web browser to desktop)

### upgrade

If a peer wants to upgrade from *weak* protocol
to a *strong* one, they simply start serving *strong* via another port,
and advertise that in the lookup system.
Now peers that have support for *strong* can connect via that protocol.

Once most peers have upgraded to strong, support for *weak* can be discontinued.

### bridging

Regular servers can do TCP. Desktop clients can speak TCP,
but can't create TCP servers reliably. Browsers can
use WebSockets and WebRTC. WebRTC gives you p2p, but
needs an introducer. Another option is [utp](https://github.com/mafintosh/utp-native)
- probably the most convienent, because it doesn't need an introducer
on _every connection_ (but it does require some bootstrapping),
but that doesn't work in the browser either.

``` js
var MultiServer = require('multiserver')

var ms = MultiServer([
  require('multiserver/plugins/net')({port: 1234}),
  require('multiserver/plugins/ws')({port: 2345})
])

//start a server (for both protocols!)
//returns function to close the server.
var close = ms.server(function (stream) {
  //handle incoming connection
})

//connect to a protocol. uses whichever
//handler understands the address (in this case, websockets)
var abort = ms.client('ws://localhost:1234', function (err, stream) {
  //...
})

//at any time abort() can be called to cancel the connection attempt.
//if it's called after the connection is established, it will
//abort the stream.
```

### example - server with two security protocols

This is just how some services (eg, github) have an API version
in their URL scheme. It is now easy to use two different
versions in parallel. later, they can close down the old API.
``` js
var MultiServer = require('multiserver')
var ms = MultiServer([
  [ //net + secret-handshake
    require('multiserver/plugins/net')({port: 3333}),
    require('secret-handshake-multiserver')({
      keys: //keypair
      appKey: //application key
      auth: //auth function (only needed for server)
    }),
  ],
  [ //net + secret-handshake2
    //(not implemented yet, but incompatible with shs)
    require('multiserver/plugins/net')({port: 4444}),
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

