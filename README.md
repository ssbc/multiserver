# multiserver

create a stream based server that uses supports
multiple types of servers with a single "url",
including the any additional layer protocols that may run over
the stream.

all streams are [pull-streams](https://github.com/dominictarr/pull-stream).

``` js
var multi = require('multiserver')

var descriptors = [
  [['tcp', port, ip]],
  [['ws', port, ip]]
]

//connect to the best protocol available
//(use tcp in node, but ws in the browser)
var stream = multi.connect(descriptors)

//create a server that listens on all the protocols.
//in order to accept connections from everywhere.
var server = multi.createServer(function (stream) {
  //stream is a pull-stream
}).listen(descriptors)
```

## License

MIT
