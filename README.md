# multiserver

A single interface that can work with multiple protocols,
and multiple transforms of those protocols (eg, security layer)

## motivation

Developing a p2p system is hard. Especially hard is upgrading protocol layers.
The contemporary approach is to [update code via a backdoor](https://whispersystems.org/blog/the-ecosystem-is-moving/),
but as easily as security can be added, [it can be taken away](https://nakamotoinstitute.org/trusted-third-parties/).

Before you can have a protocol, you need a connection between peers.
That connection is over some form of network transport,
probably encrypted with some encryption scheme, possibly
compression or other layers too.

Usually, two peers connect over a standard networking transport
(probably tcp) then they have a negotiation to decide
what the next layer (of encryption, for example) should be.
This allows protocol implementators to roll out improved
versions of the encryption protocol. However, it does
not allow them to upgrade the negotiation protocol!
If a negotiation protocol has a vulnerability it's much
harder to fix, and since the negotiation needs to be unencrypted,
it tends to reveal a lot about program the server is running.
[in my opinion, it's time to try a different way.](https://github.com/ipfs/go-ipfs/pull/34)

Some HTTP APIs provide upgradability in a better, simpler way by
putting a version number within the url. A new version of
the API can then be used without touching the old one at all.

multiserver adapts this approach to lower level protocols.
Instead of negioating which protocol to use, run multiple
protocols side by side, and consider the protocol part of the address.

Most network systems have some sort of address look up,
there is peer identifier (such it's domain) and then
a system that is queried to map that domain to the lower level
network address (such as it's ip address, retrieved via a DNS (Domain Name System) request)
To connect to a website secured with https, first
you look up the domain via DNS, then connect to the server.
Then start a tls connection to that server, in which
a cyphersuite is negotiated, and a certificate is provided
by the server. (this certifies that the server really
owns that domain)

If it was using multiserver, DNS would respond with a list of cyphersuites,
(encoded as multiserver addresses) and then you'd connect directly to a server and start using the protocol, without negotiation.
p2p systems like scuttlebutt also usually have a lookup,
but usually mapping from a public key to an ip address.
Since a look up is needed anyway, it's a good place
to provide information about the protocol that server speaks!

This enables you to do two things, upgrade and bridging.

### upgrade

If a peer wants to upgrade from *weak* protocol
to a *strong* one, they simply start serving *strong* via another port,
and advertise that in the lookup system.
Now peers that have support for *strong* can connect via that protocol.

Once most peers have upgraded to strong, support for *weak* can be discontinued.

This is just how some services (eg, github) have an API version
in their URL scheme. It is now easy to use two different
versions in parallel. later, they can close down the old API.

``` js
var MultiServer = require('multiserver')
var chloride = require('chloride')
var keys = chloride.crypto_sign_keypair()
var appKey = "dTuPysQsRoyWzmsK6iegSV4U3Qu912vPpkOyx6bPuEk="

function accept_all (id, cb) {
  cb(null, true)
}
var ms = MultiServer([
  [ //net + secret-handshake
    require('multiserver/plugins/net')({port: 3333}),
    require('multiserver/plugins/shs')({
      keys: keys,
      appKey: appKey, //application key
      auth: accept_all
    }),
  ],
  [ //net + secret-handshake2
    //(not implemented yet, but incompatible with shs)
    require('multiserver/plugins/net')({port: 4444}),
    //this protocol doesn't exist yet, but it could.
    require('secret-handshake2')({
      keys: keys,
      appKey: appKey, //application key
      auth: accept_all
    }),
  ]
])

console.log(ms.stringify())

//=> net:<host>:3333~shs:<key>;net:<host>:4444~shs2:<key>

//run two servers on two ports.
//newer peers can connect directly to 4444 and use shs2.
//this means the protocol can be _completely_ upgraded.
ms.server(function (stream) {
  console.log('connection from', stream.address)
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

### bridging

By exposing multiple network transports as part of
the same address, you can allow connections from
peers that wouldn't have been able to connect otherwise.

Regular servers can do TCP. Desktop clients can speak TCP,
but can't create TCP servers that other desktop computers can connect to reliably.
Browsers can use WebSockets and WebRTC.
WebRTC gives you p2p, but needs an introducer.
Another option is [utp](https://github.com/mafintosh/utp-native)
- probably the most convenient, because it doesn't need an introducer
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

## address format

Addresses describe everything needed to connect to a peer.
each address is divided into protocol sections separated by `~`.
Each protocol section is divided itself by `:`. A protocol section
starts with a name for that protocol, and then whatever arguments
that protocol needs. The syntax of the address format is defined by [multiserver-address](https://github.com/ssbc/multiserver-address)

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

## scopes

address also have a scope. This relates to where they
can be connected to. Default supported scopes are:

* device - can connect only if on the same device
* local - can connect from same wifi (local network)
* public - can connect from public global internet.

some transport plugins work only on particular scopes.

when `stringify(scope)` is called, it will return
just the accessible addresses in that scope.

## plugins

A multiserver instance is set up by composing a selection
of plugins that construct the networking transports,
and transforms that instance supports.

There are two types of plugins, transports and transforms.

### `net({port,host,scope})`

TCP is a `net:{host}:{port}` port is not optional.

``` js
var Net = require('multiserver/plugins/net')`
Net({port: 8889, host: 'mydomain.com'}) => net
net.stringify() => 'net:mydomain.com:8889'
```
### `WebSockets({host,port,scope,handler?,key?,cert?})`

create a websocket server. Since websockets are
just a special mode of http, this also creates a http
server. If `opts.handler` is provided, requests
to the http server can be handled, this is optional.

WebSockets `ws://{host}:{port}?` port defaults to 80 if not provided.

WebSockets over https is `wss://{host}:{port}?` where port is
443 if not provided.

If `opts.key` and `opts.cert` are provided as paths, a https server
will be spawned.

``` js
var WebSockets = require('multiserver/plugins/ws`)

var ws = WebSockets({
  port: 1234,
  host: 'mydomain.com',
  handler: function (req, res) {
    res.end('<h1>hello</h1>')
  },
  scope:...
})

ws.stringify() => 'ws://mydomain.com:1234'
```

### `Onion()`

Connect over tor using local proxy to dæmon (9050) or tor browser (9150). 
Both will be tried to find a suitable tor instance. 
The tor ports are unconfigurable. The standard
tor ports are always used.

This plugin does not support creating a server.
You should use tor's configuration files to send incoming connections to a `net`
instance as a hidden service.

An accepted onion address looks like: `onion:{host}:{port}`
port is not optional. This plugin does not return
an address, so you must construct this address manually.

``` js
var Onion = require('multiserver/plugins/onion`)


var onion = WebSockets({
  //no config is needed except scope, but you
  //surely will use this with "public" which is the default
  //scope:'public'
})

ws.stringify() => null
```


### `Bluetooth({bluetoothManager})`

The [multiserver-bluetooth](https://github.com/Happy0/multiserver-bluetooth) module implements a multiserver protocol for to communicate over Bluetooth Serial port.

### `reactnative = require('multiserver-rn-channel')`

The [multiserver-rn-channel](http://npm.im/multiserver-rn-channel) module implementes
a multiserver protocol for use inbetween the reactnative nodejs process and browser process.

### `SHS({keys,timeout?,appKey,auth})`

Secret-handshake is `shs:{public_key}:{seed}?`. `seed` is used to create
a one-time shared private key, that may enable a special access.
For example, you'll see that ssb invite codes have shs with two sections
following. Normally, only a single argument (the remote public key) is necessary.

``` js
var SHS = require('multiserver/plugins/shs')

var shs = SHS({
  keys: keys,
  timeout: //set handshake timeout, if unset falls through to secret-handshake default
  appKey: //sets an appkey
  auth: function (id, cb) {
    if(isNotAuthorized(id))
      cb(new Error())
    else
      cb(null, authenticationDetails)
  }
})
shs.stringify() => 'shs:{keys.publicKey.toString('base64')}
```

note, if the `auth` function calls back a truthy value,
it is considered authenticated. The value called back
may be an object that represents details of the authentication.
when a successful connection goes through `shs` plugin,
the stream will have an `auth` property, which is the value called back from `auth`,
and a `remote` property (the id of remote key).

### `Noauth({keys})`

This authenticates any connection without any encryption.
This should only be used on `device` scoped connections,
such as if net is bound strictly to localhost,
or a unix-socket. Do not use with ws or net bound to public addresses.

``` js
var Noauth = require('multiserver/plugins/noauth')

var noauth = Noauth({
  keys: keys
})
shs.stringify() => 'shs:{keys.publicKey.toString('base64')}

```

streams passing through this will look like an authenticated shs connection.

### `Unix = require('multiserver/plugins/unix-socket')`

network transport is unix socket. to connect to this
you must have access to the same file system as the server.

``` js
var Unix = require('multiserver/plugins/unix-socket')

var unix = Unix({
  path: where_to_put_socket,
  scope: ... //defaults to device
})

unix.stringify() => "unix:{where_to_put_socket}"
```


### createMultiServer([[transport,transforms...],...])

A server that runs multiple protocols on different ports can simply join them
with `;` and clients should connect to their preferred protocol.
clients may try multiple protocols on the same server before giving up,
but generally it's unlikely that protocols should not fail independently
(unless there is a bug in one protocol).

an example of a valid multiprotocol:
`net:{host}:{port}~shs:{key};ws:{host}:{port}~shs:{key}`

``` js
var MultiServer = require('multiserver')

var ms = MultiServer([
  [net, shs],
  [ws, shs],
  [unix, noauth]
])

ms.stringify('public') => "net:mydomain.com:8889~shs:<key>;ws://mydomain.com:1234~shs:<key>"
ms.stringify('device') => "unix:{where_to_put_socket}"

ms.server(function (stream) {
  //now that all the plugins are combined,
  //ready to use as an actual server.
})
```

## interfaces

To construct a useful multiserver instance,
one or more transport is each connected with zero
or more transforms. The combine function is
the default export from the `multiserver` module.

``` js
var MultiServer = require('multiserver')

var ms = MultiServer([
  [transport1, transform1],
  [transport2, transform2, transform3],
])

var close = ms.server(function (stream) {
  //called when a stream connects
}, onError, onListening)
```

```
createMultiServer([[Transform, Transports*,...]], *]) => MultiServer
```

a MultiServer has the same interface as a Transport,
but using a combined multiserver instance as a transport
is **not** supported.

## createTransport(Options) => Transport

The transport exposes a name and the ability to
create and connect to servers running that transport.

``` js
Transport => {
  // that describes the sub protocols
  name,
  // connect to server with address addr.
  client (addr, cb),
  // start the server
  server (onConnect, onError, onListening),
  // return string describing how to connect to the server, aka, "the address"
  // the address applies to a `scope`.
  stringify(scope),
  // parse the addr,
  // normally this would probably return the
  // Options used to create the transport.
  parse(string) => Options
}
```

## createTransform(options) => Transform

``` js
Transform => {
  name: string,
  create(Options) => (stream, cb(null, transformed_stream)),
  parse (str) => Options,
  stringify() => string,
}
```

note the create method on a Transform takes Options,
and returns a function that takes a stream and a callback,
and then calls back the transformed stream.
In all cases the stream is a [duplex stream](https://github.com/pull-stream/pull-stream)

## License

MIT










