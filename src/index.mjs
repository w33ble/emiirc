import tls from 'tls';
import net from 'net';
import crypto from 'crypto';
import { EventEmitter } from 'events';

const EOL = '\r\n';
const END_MOTD = 376;
const JOIN_TOPIC = 332;
const JOIN_NAMES = 353;
const NOTICE = 'NOTICE';
const JOIN = 'JOIN';
const PART = 'PART';
const PRIVMSG = 'PRIVMSG';
const QUIT = 'QUIT';

// helper functions
const randString = len =>
  crypto
    .randomBytes(Math.ceil(len / 2))
    .toString('hex')
    .slice(0, len);
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
  [NOTICE]: ({ parts, emitter, options }) => {
    const msg = getPartFrom(parts, 3);
    if (/NickServ identify/i.test(msg)) {
      emitter.emit('nick_unidentified', {
        user: options.nick,
        msg,
      });
    } else if (/now identified/i.test(msg)) {
      emitter.emit('nick_identified', {
        user: options.nick,
        msg,
      });
    } else {
      emitter.emit('notice', {
        msg,
      });
    }
  },
  [END_MOTD]: ({ emitter }) => emitter.emit('motd'),
  [JOIN_TOPIC]: ({ parts, emitter }) =>
    emitter.emit('join_topic', {
      room: getPart(parts, 2),
      topic: getPartFrom(parts, 4).slice(1),
    }),
  [JOIN_NAMES]: ({ parts, emitter, line }) =>
    emitter.emit('join_users', {
      room: getPart(parts, 2),
      users: parseNames(line),
    }),
  [JOIN]: ({ parts, emitter }) =>
    emitter.emit('join', {
      room: getPart(parts, 2),
      user: parseUsername(parts),
    }),
  [PART]: ({ parts, emitter }) =>
    emitter.emit('part', {
      room: getPart(parts, 2),
      user: parseUsername(parts),
    }),
  [PRIVMSG]: ({ parts, emitter, options }) => {
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
  [QUIT]: ({ parts, emitter }) =>
    emitter.emit('quit', {
      user: parseUsername(parts),
      reason: getPartFrom(parts, 2).slice(1),
    }),
};

export default class Client {
  constructor(hostname, port = 6667, opts = {}) {
    this.hostname = hostname;
    this.port = port;
    const defaultNick = `emiirc-${randString(6)}`;
    this.options = {
      nick: defaultNick,
      pass: null,
      username: defaultNick,
      realname: 'an emiirc bot',
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
      send: input => this.send(input),
      quit: msg => this.quit(msg),
      join: chan => this.join(chan),
      part: chan => this.part(chan),
      login: details => this.login(details),
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
        this.emitter.emit('close', { fromError: networkError });
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

  login(opt = {}) {
    // update login details
    if (opt.nick) this.options.nick = opt.nick;
    if (opt.username) this.options.username = opt.username;
    if (opt.realname) this.options.realname = opt.realname;

    const { nick, username, realname, channels } = this.options;

    this.send(`NICK ${nick}`);
    this.send(`USER ${username} 8 * :${realname}`);

    if (channels != null && channels.length) {
      const c = !Array.isArray(channels) ? [channels] : channels;
      c.forEach(chan => this.join(chan));
    }
  }

  send(input) {
    this.emitter.emit('send', input);
    this.socket.write(`${input}${EOL}`);
  }

  join(chan) {
    this.send(`JOIN ${normalizeChannel(chan)}`);
  }

  part(chan) {
    this.send(`PART ${normalizeChannel(chan)}`);
  }

  quit(msg = '') {
    this.emitter.emit('quit');
    this.send(`QUIT :${msg}`);
  }

  parseInput(line) {
    const parts = line.split(' ');

    // respond to server PING requests
    if (parts[0] === 'PING') {
      this.send(`PONG ${parts.slice(1).join(' ')}`);
    }

    // pass input off to line handlers, if a match exists
    const fn = lineMap[getPart(parts, 1)];
    if (fn) {
      fn({
        parts,
        emitter: this.emitter,
        options: this.options,
        line,
      });
    }
  }
}
