export default function(channels, pw) {
  return function loginAndJoin() {
    const pass = pw || this.options.pass;

    const autoJoin = () => {
      if (channels != null && channels.length) {
        const c = !Array.isArray(channels) ? [channels] : channels;
        c.forEach(chan => this.join(chan));
      }
    };

    // if pass is not provided, just join channels
    if (!pass) {
      this.emitter.once('motd', () => {
        autoJoin();
      });
      return;
    }

    // identify and join channels
    this.emitter.once('nick_unidentified', () => {
      this.authenticate(pass);
    });

    this.emitter.once('nick_identified', () => {
      autoJoin();
    });
  };
}
