const {
  AudioPlayerStatus,
  VoiceConnectionStatus,
  createAudioPlayer,
  createAudioResource,
  joinVoiceChannel,
  NoSubscriberBehavior,
  entersState,
} = require('@discordjs/voice');
const playdl = require('play-dl');
const { GuildQueue } = require('./queue');
const { getPlayableTrack } = require('./search');
const logger = require('../logger');

class MusicPlayer {
  constructor(guildId, textChannel) {
    this.guildId = guildId;
    this.textChannel = textChannel;
    this.connection = null;
    this.audioPlayer = createAudioPlayer({
      behaviors: {
        noSubscriber: NoSubscriberBehavior.Pause,
      },
    });
    this.guildQueue = new GuildQueue();
    this.isReady = false;
    this.currentTrack = null;

    this.audioPlayer.on('stateChange', async (oldState, newState) => {
      if (newState.status === AudioPlayerStatus.Idle && this.guildQueue.current) {
        this.playNext();
      }
    });

    this.audioPlayer.on('error', (error) => {
      logger.error(`Playback error in guild ${guildId}:`, error.message || error);
      this.textChannel?.send('Playback failed. The current track could not be played and the queue was kept intact.');
    });
  }

  async join(userVoiceChannel) {
    if (!userVoiceChannel) {
      throw new Error('A voice channel is required to join.');
    }

    this.connection = joinVoiceChannel({
      channelId: userVoiceChannel.id,
      guildId: userVoiceChannel.guild.id,
      adapterCreator: userVoiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    this.connection.on('stateChange', async (_, newState) => {
      if (newState.status === VoiceConnectionStatus.Disconnected) {
        logger.warn(`Voice connection disconnected in guild ${this.guildId}.`);
      }
    });

    this.connection.subscribe(this.audioPlayer);
    this.isReady = true;
    return this.connection;
  }

  async enqueue(queryOrTrack, requester = 'unknown') {
    const track = typeof queryOrTrack === 'string' ? await getPlayableTrack(queryOrTrack) : queryOrTrack;
    if (!track) {
      throw new Error('No compatible YouTube match was found for that request.');
    }

    track.requester = requester;
    this.guildQueue.enqueue(track);

    if (!this.currentTrack && this.guildQueue.current === null) {
      await this.playNext();
    }

    return track;
  }

  async playNext() {
    if (!this.connection) {
      return null;
    }

    const nextTrack = this.guildQueue.advance();
    if (!nextTrack) {
      this.currentTrack = null;
      return null;
    }

    this.currentTrack = nextTrack;
    const stream = await playdl.stream(nextTrack.url, { quality: 1 });
    const resource = createAudioResource(stream.stream, {
      inputType: stream.type,
      inlineVolume: true,
    });

    resource.volume?.setVolume(0.35);
    this.audioPlayer.play(resource);
    this.textChannel?.send(`Now playing: **${nextTrack.title}** by **${nextTrack.artist}**.`);
    return nextTrack;
  }

  skip() {
    this.audioPlayer.stop();
    const nextTrack = this.guildQueue.skip();
    if (nextTrack) {
      this.playNext().catch((error) => logger.error(error));
    }
    return nextTrack;
  }

  stop() {
    this.guildQueue.stop();
    this.audioPlayer.stop();
    this.currentTrack = null;
    this.textChannel?.send('Playback stopped and the queue was cleared.');
  }

  pause() {
    this.audioPlayer.pause();
  }

  resume() {
    this.audioPlayer.unpause();
  }

  previous() {
    const previousTrack = this.guildQueue.previous();
    if (!previousTrack) {
      return null;
    }

    this.playNext().catch((error) => logger.error(error));
    return previousTrack;
  }

  status() {
    return {
      guildId: this.guildId,
      isConnected: Boolean(this.connection),
      current: this.currentTrack,
      queueLength: this.guildQueue.length,
      queue: this.guildQueue.upcoming,
      status: this.guildQueue.status,
      listening: true,
    };
  }

  leave() {
    this.audioPlayer.stop();
    this.guildQueue.stop();
    this.currentTrack = null;
    if (this.connection) {
      this.connection.destroy();
      this.connection = null;
    }
    this.isReady = false;
    this.textChannel?.send('Left the voice channel and stopped playback.');
  }
}

module.exports = {
  MusicPlayer,
};
