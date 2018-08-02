# emiirc

event emitting irc client.

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/w33ble/emiirc/master/LICENSE)
[![npm](https://img.shields.io/npm/v/emiirc.svg)](https://www.npmjs.com/package/emiirc)
[![Project Status](https://img.shields.io/badge/status-experimental-orange.svg)](https://nodejs.org/api/documentation.html#documentation_stability_index)

## Usage

```js
// test.mjs
import Client from '.';

const client = new Client('irc.freenode.net', '6667', {
  nick: process.argv[2] || 'emiircbot-demo',
  channels: process.argv.slice(3) || [],
});

client.on('connect', () => console.log('CONNECTED'));
client.on('close', fromErr => {
  console.log('DISCONNECTED');
  if (fromErr) {
    console.log('RECONNECTING...');
    client.connect();
  }
});
// client.on('data', data => console.log('DEBUG|', data));
client.on('error', err => console.error(err));
client.on('send', d => console.log('SEND|', d));
client.on('motd', () => console.log('MOTD complete'));

client.on('message', res => console.log('message|', res));
client.on('private', res => console.log('private|', res));
client.on('command', res => console.log('command|', res));

client.on('join', res => console.log('join|', res));
client.on('join_users', res => console.log('join_users|', res));
client.on('join_topic', res => console.log('join_topic|', res));
client.on('quit', res => console.log('quit|', res));

client.connect();
```

Then `node test.mjs mybot emiirc-demo-channel`. The following will create a new instance with a nick "mybot", join the channel "#emiirc-demo-channel" and start parsing input from IRC.

*NOTE:* You may need to use `node --experimental-modules` or `node -r esm` depending on your node version's ESM support.

Given the following observations:

1. Public welcome message from user "w33ble"
1. Public command via `!mybot` from user "w33ble"
1. Private message from user "w33ble"

You should see the following output:

```
SEND| NICK mybot
SEND| USER emiirc 8 * :emiirc bot
SEND| JOIN #emiirc-demo-channel
MOTD complete
private| { user: 'frigg', room: 'mybot', msg: '\u0001VERSION\u0001\r' }
join| { user: 'mybot', room: '#emiirc-demo-channel' }
join_users| { room: 'mybot', users: [ 'mybot', 'w33ble' ] }
message| { user: 'w33ble',
  room: '#emiirc-demo-channel',
  msg: 'hello mybot!\r' }
command| { user: 'w33ble',
  room: '#emiirc-demo-channel',
  msg: 'make me a sandwich' }
private| { user: 'w33ble',
  room: 'mybot',
  msg: 'let\'s have a private chat, shall we?\r' }
```

#### License

MIT © [w33ble](https://github.com/w33ble)