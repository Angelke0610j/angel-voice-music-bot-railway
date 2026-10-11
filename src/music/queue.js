class GuildQueue {
  constructor() {
    this.queue = [];
    this.history = [];
    this.current = null;
    this.status = 'idle';
  }

  enqueue(track) {
    this.queue.push(track);
    if (!this.current && this.status === 'idle') {
      this.status = 'queued';
    }
    return this.queue.length;
  }

  advance() {
    if (this.current) {
      this.history.push(this.current);
    }

    const nextTrack = this.queue.shift() || null;
    this.current = nextTrack;
    this.status = nextTrack ? 'playing' : 'idle';
    return nextTrack;
  }

  skip() {
    return this.advance();
  }

  previous() {
    if (!this.current && this.history.length === 0) {
      return null;
    }

    const previousTrack = this.history.pop() || null;
    if (!previousTrack) {
      return null;
    }

    const currentTrack = this.current;
    if (currentTrack) {
      this.queue.unshift(currentTrack);
    }

    this.current = previousTrack;
    this.status = 'playing';
    return previousTrack;
  }

  stop() {
    this.queue = [];
    this.history = [];
    this.current = null;
    this.status = 'stopped';
  }

  clear() {
    this.stop();
  }

  get length() {
    return this.queue.length + (this.current ? 1 : 0);
  }

  get upcoming() {
    return this.queue.slice();
  }

  toJSON() {
    return {
      current: this.current,
      queue: this.queue,
      history: this.history,
      status: this.status,
    };
  }
}

module.exports = {
  GuildQueue,
};
