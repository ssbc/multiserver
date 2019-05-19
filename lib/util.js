var os
try {
  os = require('os')
} catch (_) {
  // Uncaught because this should work in a browser.
}

const metaAddresses = [
  '0.0.0.0',
  '::'
]

const getNetworkAddresses = ({ internal, family } = {}) =>
  Object.values(os.networkInterfaces())
    // Flatten
    .reduce((acc, val) => acc.concat(val), [])
    // Filter `internal`
    .filter(item => internal == null || item.internal === internal)
    // Filter `family`
    .filter(item => family == null || item.family === family)
    // Filter scoped IPv6 addresses, which don't play nicely with Node.js
    .filter(item => item.scopeid == null || item.scopeid === 0)
    // Only return the address.
    .map(item => item.address)

// Choose a dynamic port between 49152 and 65535
// https://en.wikipedia.org/wiki/List_of_TCP_and_UDP_port_numbers#Dynamic,_private_or_ephemeral_ports
module.exports.getRandomPort = () =>
  Math.floor(49152 + (65535 - 49152 + 1) * Math.random())

module.exports.protocolToAddress = (protocol) =>
  (host, port) => [protocol, host, port ].join(':')

module.exports.getAddress = (host, scope) => {
  if (scope === 'device') {
    return 'localhost' // legacy
  }

  if (typeof host === 'string' && metaAddresses.includes(host) === false) {
    return host
  }

  return getNetworkAddresses({
    internal: (scope === 'device'),
    family: (host === '0.0.0.0' ? 'IPv4' : null)
  })
}

