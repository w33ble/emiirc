export default function() {
  return function reconnect() {
    this.emitter.on('close', ({ fromError }) => {
      if (fromError) {
        this.emitter.connect();
      }
    });
  };
}
