# emiirc

event emitting irc client.

[![GitHub license](https://img.shields.io/badge/license-MIT-blue.svg)](https://raw.githubusercontent.com/w33ble/emiirc/master/LICENSE)
[![npm](https://img.shields.io/npm/v/emiirc.svg)](https://www.npmjs.com/package/emiirc)
[![Project Status](https://img.shields.io/badge/status-experimental-orange.svg)](https://nodejs.org/api/documentation.html#documentation_stability_index)

## Usage

```js
// test.mjs
import loginAndJoin from './src/plugins/login-join.mjs';
import reconnect from './src/plugins/reconnect.mjs';
import Client from '.';

const [nick, pass] = (process.argv[2] || '').split(':');

const client = new Client('irc.freenode.net', '6667', {
  nick: nick || 'emiircbot-demo',
});

client.use(reconnect());
client.use(loginAndJoin(process.argv.slice(3) || [], pass));

if (Number(process.env.DEBUG) >= 2) client.on('data', data => console.log('DEBUG|', data));
if (Number(process.env.DEBUG) >= 1) client.on('notice', data => console.log('NOTICE|', data));

client.on('connected', () => console.log('CONNECTED'));
client.on('close', () => console.log('CONNECTION CLOSED'));
client.on('error', err => console.error(err));

client.on('nick_used', res => console.log('nick_used', res));
client.on('nick_unidentified', res => console.log('nick_unidentified', res));
client.on('nick_identified', res => console.log('nick_identified', res));

client.on('motd', () => console.log('MOTD complete'));
client.on('send', d => console.log('SEND|', d));
client.on('message', res => console.log('message|', res));
client.on('private', res => console.log('private|', res));
client.on('command', res => console.log('command|', res));

client.on('join', res => console.log('join|', res));
client.on('join_failed', res => console.log('join_failed|', res));
client.on('join_users', res => console.log('join_users|', res));
client.on('join_topic', res => console.log('join_topic|', res));
client.on('part', res => console.log('part|', res));
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
CONNECTED
SEND| NICK mybot
SEND| USER emiirc-260ca9 8 * :an emiirc bot
SEND| JOIN #emiirc-demo-channel
MOTD complete
private| { user: 'frigg', room: 'mybot', msg: '\u0001VERSION\u0001\r' }
join| { room: '#emiirc-demo-channel', user: 'mybot' }
join_topic| { room: 'mybot', topic: 'testing out emiirc\r' }
join_users| { room: 'mybot', users: [ 'mybot', 'w33ble' ] }join| { user: 'mybot', room: '#emiirc-demo-channel' }
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