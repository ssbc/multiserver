# multiserver

A single interface that can create multiple protocols at once.

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

## examples

## License

MIT


