import tls from 'tls';
import net from 'net';
import { EventEmitter } from 'events';

const EOL = '\r\n';
const END_MOTD = 376;
const JOIN_TOPIC = 332;
const JOIN_NAMES = 353;
const JOIN = 'JOIN';
const PART = 'PART';
const PRIVMSG = 'PRIVMSG';
const QUIT = 'QUIT';

// helper functions
const normalizeChannel = chan => (chan[0] === '#' ? chan : `#${chan}`);
const plainUsername = n => n.replace(/^[~&@%+]/g, '');
const getPart = (parts, i = 0, rest = false) => {
  const part = parts[i];
  if (!part) return null;
  return rest ? parts.slice(i) : part.trim();
};
const getPartFrom = (parts, i = 0) => getPart(parts, i, true).join(' ');
const parseUsername = parts =>
  getPart(parts, 0)
    .split('!')[0]
    .slice(1);
const parseNames = line =>
  line
    .split(':')[2]
    .trim()
    .split(' ')
    .map(plainUsername);

// maps line parser results to events
const lineMap = {
  [END_MOTD]: (_, { emitter }) => emitter.emit('motd'),
  [JOIN_TOPIC]: (parts, { emitter }) => emitter.emit('join_topic', getPartFrom(parts, 4).slice(1)),
  [JOIN_NAMES]: (parts, { emitter, line }) =>
    emitter.emit('join_users', {
      room: getPart(parts, 2),
      users: parseNames(line),
    }),
  [JOIN]: (parts, { emitter }) =>
    emitter.emit('join', {
      room: getPart(parts, 2),
      user: parseUsername(parts),
    }),
  [PART]: (parts, { emitter }) =>
    emitter.emit('part', {
      room: getPart(parts, 2),
      user: parseUsername(parts),
    }),
  [PRIVMSG]: (parts, { emitter, options }) => {
    const cmd = `!${options.nick}`;
    const user = parseUsername(parts);
    const room = getPart(parts, 2);
    const msg = getPartFrom(parts, 3).slice(1);

    if (msg.indexOf(`!${options.nick}`) === 0) {
      emitter.emit('command', { room, user, msg: msg.replace(cmd, '').trim() });
    } else {
      const payload = { room, user, msg };
      emitter.emit(room === options.nick ? 'private' : 'message', payload);
    }
  },
  [QUIT]: (parts, { emitter }) =>
    emitter.emit('quit', {
      user: parseUsername(parts),
      reason: getPartFrom(parts, 2).slice(1),
    }),
};

export default class Client {
  constructor(hostname, port = 6667, opts = {}) {
    this.hostname = hostname;
    this.port = port;
    this.options = {
      nick: 'emiirc-bot',
      username: 'emiirc',
      realname: 'emiirc bot',
      channels: [],
      secure: false,
      lazyCA: true,
      login: true,
      ...opts,
    };
    this.network = this.options.secure ? tls : net;
    this.emitter = new EventEmitter();
    this.connected = false;

    return {
      // public methods
      connect: () => this.connect(),
      disconnect: () => this.disconnect(),
      join: chan => this.join(chan),
      part: chan => this.part(chan),
      login: () => this.login(),
      // emitter methods
      on: (...args) => this.emitter.on(...args),
      off: (...args) => this.emitter.off(...args),
      once: (...args) => this.emitter.once(...args),
    };
  }

  connect() {
    if (this.connected) throw new Error('Only one connection is allowed');

    // create the network socket
    this.socket = this.network.connect(
      {
        host: this.hostname || 'localhost',
        port: this.port,
        rejectUnauthorized: !!(this.options.secure && this.options.lazyCA),
      },
      () => {
        // called on connection
        this.connected = true;
        this.emitter.emit('connected');

        if (this.options.login) this.login();
      }
    );

    // attach global socket listeners
    this.socket
      .on('close', () => {
        const networkError = !!this.connected;
        this.connected = false;
        this.emitter.emit('close', networkError);
      })
      .on('error', err => {
        this.emitter.emit('error', err);
      });

    this.socket.setEncoding('utf-8');

    // listen for data on the socket
    this.socket.on('data', data => {
      data
        .split('\n')
        .filter(d => d !== '')
        .forEach(d => {
          this.emitter.emit('data', d);
          this.parseInput(d);
        });
    });
  }

  disconnect() {
    this.socket.end();
    this.socket.destroy();
    this.connected = false;
  }

  login() {
    const { nick, username, realname, channels } = this.options;
    this.send(`NICK ${nick}`);
    this.send(`USER ${username} 8 * :${realname}`);

    if (channels.length) {
      const c = !Array.isArray(channels) ? [channels] : channels;
      c.forEach(chan => this.join(chan));
    }
  }

  send(input) {
    this.emitter.emit('send', input);
    this.socket.write(`${input}${EOL}`);
  }

  join(chan) {
    this.send(`JOIN ${normalizeChannel(chan)}`)
  }

  part(chan) {
    this.send(`PART ${normalizeChannel(chan)}`)
  }

  parseInput(line) {
    const parts = line.split(' ');

    // pass input off to line handlers, if a match exists
    const fn = lineMap[getPart(parts, 1)];
    if (fn) {
      fn(parts, {
        emitter: this.emitter,
        options: this.options,
        line,
      });
    }
  }
}
