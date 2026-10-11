const { EndBehaviorType } = require('@discordjs/voice');

class VoiceListener {
  constructor({ transcriber, logger, wakePhrase, onWakePhrase, onRequestText }) {
    this.transcriber = transcriber;
    this.logger = logger;
    this.wakePhrase = wakePhrase || 'Hey Angel';
    this.onWakePhrase = onWakePhrase || (() => {});
    this.onRequestText = onRequestText || (() => {});
    this.connection = null;
    this.enabled = false;
    this.lastWakeAt = 0;
  }

  start(connection, botUserId) {
    if (!connection || !this.transcriber) {
      return false;
    }

    this.connection = connection;
    this.botUserId = botUserId;
    this.enabled = true;

    const receiver = connection.receiver;

    receiver.speaking.on('start', (userId) => {
      if (!this.enabled || userId === this.botUserId) return;

      const subscription = receiver.subscribe(userId, {
        end: {
          behavior: EndBehaviorType.AfterSilence,
          duration: 500,
        },
      });

      if (!subscription) return;

      const chunks = [];
      subscription.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      subscription.on('end', async () => {
        if (chunks.length === 0) return;

        try {
          const result = await this.transcriber.transcribeAudioChunk(chunks);
          const transcript = result && result.text ? String(result.text).trim() : '';
          if (!transcript) return;

          if (this._matchesWakePhrase(transcript)) {
            const now = Date.now();
            if (now - this.lastWakeAt < 15000) {
              return;
            }
            this.lastWakeAt = now;
            this.logger.info('Wake phrase detected:', transcript);
            this.onWakePhrase(transcript);
            return;
          }

          if (this.lastWakeAt && Date.now() - this.lastWakeAt < 30000) {
            this.logger.info('Speech request captured:', transcript);
            this.onRequestText(transcript);
          }
        } catch (error) {
          this.logger.warn('Voice transcription failed:', error.message || error);
        }
      });
    });

    return true;
  }

  stop() {
    this.enabled = false;
    this.connection = null;
  }

  _matchesWakePhrase(text) {
    return text.toLowerCase().includes(this.wakePhrase.toLowerCase());
  }
}

module.exports = {
  VoiceListener,
};
