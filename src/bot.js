const { Client, Events, GatewayIntentBits, Collection } = require('discord.js');
const { MusicPlayer } = require('./music/player');
const { PlaylistStore } = require('./storage/playlistStore');
const { commandDefinitions } = require('./commands');
const { createTranscriber } = require('./transcription/transcriber');
const { VoiceListener } = require('./voice/listener');
const logger = require('./logger');
const config = require('./config');

class AngelBot extends Client {
  constructor() {
    super({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
      ],
    });

    this.musicPlayers = new Collection();
    this.playlistStore = new PlaylistStore(config.PLAYLIST_STORE_FILE);
    this.transcriber = createTranscriber(config.TRANSCRIPTION_PROVIDER, {
      apiKey: config.GEMINI_API_KEY,
    });
    this.listenEnabled = config.LISTEN_ENABLED;
    this.voiceListeners = new Collection();
    this.wakePhrase = config.WAKE_PHRASE;

    this.once(Events.ClientReady, () => this.onReady());
    this.on(Events.InteractionCreate, (interaction) => this.handleInteraction(interaction));
  }

  async onReady() {
    logger.info(`Logged in as ${this.user.tag}`);

    try {
      const registered = await this.registerCommands();
      logger.info(`Registered ${registered} slash commands.`);
    } catch (error) {
      logger.error('Failed to register slash commands:', error.message || error);
    }

    if (this.transcriber && typeof this.transcriber.initialize === 'function') {
      const ready = await this.transcriber.initialize();
      if (ready) {
        logger.info(`Transcription provider enabled: ${this.transcriber.name}`);
      } else if (this.transcriber.name === 'gemini') {
        logger.warn('Gemini transcription is disabled. Set GEMINI_API_KEY to enable it.');
      } else {
        logger.warn('No transcription provider configured. Voice wake-word detection will remain disabled.');
      }
    }
  }

  async registerCommands() {
    const targetGuild = config.GUILD_ID ? this.guilds.cache.get(config.GUILD_ID) : null;

    if (targetGuild) {
      await targetGuild.commands.set(commandDefinitions);
      return commandDefinitions.length;
    }

    await this.application.commands.set(commandDefinitions);
    return commandDefinitions.length;
  }

  getGuildPlayer(guildId) {
    if (!this.musicPlayers.has(guildId)) {
      const textChannel = this.channels.cache.find((channel) => channel.isTextBased && channel.isTextBased());
      this.musicPlayers.set(guildId, new MusicPlayer(guildId, textChannel));
    }
    return this.musicPlayers.get(guildId);
  }

  async handleInteraction(interaction) {
    if (!interaction.isChatInputCommand()) return;

    const { commandName, guildId } = interaction;
    const player = this.getGuildPlayer(guildId);

    try {
      switch (commandName) {
        case 'join':
          if (!interaction.member?.voice?.channel) {
            return interaction.reply({ content: 'Join a voice channel first.', ephemeral: true });
          }
          await player.join(interaction.member.voice.channel);
          this.startVoiceListener(player, interaction.guildId, interaction.guild); 
          await interaction.reply({ content: `Joined ${interaction.member.voice.channel.name}.`, ephemeral: false });
          break;

        case 'leave':
          player.leave();
          await interaction.reply('Disconnected from the voice channel.');
          break;

        case 'status': {
          const status = player.status();
          await interaction.reply({
            content: `Status: ${status.status}\nQueue length: ${status.queueLength}\nCurrent: ${status.current ? status.current.title : 'none'}\nConnected: ${status.isConnected ? 'yes' : 'no'}`,
            ephemeral: false,
          });
          break;
        }

        case 'play': {
          const song = interaction.options.getString('song');
          if (!song) {
            return interaction.reply({ content: 'You must provide a song title or lyric fragment.', ephemeral: true });
          }

          const queuedTrack = await player.enqueue(song, interaction.user.username);
          await interaction.reply({ content: `Queued: **${queuedTrack.title}** by **${queuedTrack.artist}**`, ephemeral: false });
          break;
        }

        case 'skip':
          player.skip();
          await interaction.reply('Skipped the current track.');
          break;

        case 'stop':
          player.stop();
          await interaction.reply('Playback stopped and the queue was cleared.');
          break;

        case 'next':
          player.skip();
          await interaction.reply('Moved to the next track.');
          break;

        case 'previous':
          const previousTrack = player.previous();
          await interaction.reply(previousTrack ? `Went back to **${previousTrack.title}**.` : 'No previous track is available.');
          break;

        case 'pause':
          player.pause();
          await interaction.reply('Paused playback.');
          break;

        case 'resume':
          player.resume();
          await interaction.reply('Resumed playback.');
          break;

        case 'help':
          await interaction.reply({
            content: 'Available commands: /join, /leave, /play song:<title>, /skip, /stop, /next, /previous, /pause, /resume, /status, /playlist, /listen enabled:<true|false>, /settings, /help',
            ephemeral: false,
          });
          break;

        case 'settings':
          await interaction.reply({
            content: `Wake phrase: ${this.wakePhrase}\nListen enabled: ${this.listenEnabled ? 'yes' : 'no'}\nSpeech provider: ${this.transcriber?.name || 'disabled'}`,
            ephemeral: false,
          });
          break;

        case 'listen': {
          const enabled = interaction.options.getBoolean('enabled');
          this.listenEnabled = enabled;
          await interaction.reply({ content: `Voice listening is now ${enabled ? 'enabled' : 'disabled'}.`, ephemeral: false });
          break;
        }

        case 'playlist': {
          const subCommand = interaction.options.getSubcommand();
          const name = interaction.options.getString('name');
          const song = interaction.options.getString('song');

          if (subCommand === 'list') {
            const playlists = this.playlistStore.listPlaylists(guildId);
            if (!playlists.length) {
              await interaction.reply({ content: 'No saved playlists found for this guild.', ephemeral: false });
              return;
            }
            const summary = playlists.map((playlist) => `${playlist.name} (${playlist.songs.length} songs)`).join('\n');
            await interaction.reply({ content: summary, ephemeral: false });
            return;
          }

          if (subCommand === 'add') {
            if (!name || !song) {
              await interaction.reply({ content: 'Playlist name and song title are required.', ephemeral: true });
              return;
            }

            const existing = this.playlistStore.getPlaylist(guildId, name).songs;
            if (!existing.length && !this.playlistStore.createPlaylist(guildId, name)) {
              // playlist exists already, continue to add the song
            }

            const track = await player.enqueue(song, interaction.user.username).catch(() => null);
            const entry = track ? { title: track.title, artist: track.artist, url: track.url } : { title: song, artist: 'manual', url: song };
            this.playlistStore.addSong(guildId, name, entry);
            await interaction.reply({ content: `Added **${entry.title}** to playlist **${name}**.`, ephemeral: false });
            return;
          }

          if (subCommand === 'view') {
            if (!name) {
              await interaction.reply({ content: 'A playlist name is required.', ephemeral: true });
              return;
            }
            const playlist = this.playlistStore.getPlaylist(guildId, name);
            const songs = playlist.songs.length ? playlist.songs.map((song, index) => `${index + 1}. ${song.title || song}`).join('\n') : 'No songs yet.';
            await interaction.reply({ content: `Playlist **${name}**\n${songs}`, ephemeral: false });
            return;
          }

          if (subCommand === 'play') {
            if (!name) {
              await interaction.reply({ content: 'A playlist name is required.', ephemeral: true });
              return;
            }
            const playlist = this.playlistStore.getPlaylist(guildId, name);
            if (!playlist.songs.length) {
              await interaction.reply({ content: `Playlist **${name}** is empty.`, ephemeral: false });
              return;
            }

            for (const entry of playlist.songs) {
              await player.enqueue(entry.url || entry.title || entry, interaction.user.username).catch(() => null);
            }

            await interaction.reply({ content: `Queued playlist **${name}**.`, ephemeral: false });
            return;
          }

          if (subCommand === 'delete') {
            if (!name) {
              await interaction.reply({ content: 'A playlist name is required.', ephemeral: true });
              return;
            }
            this.playlistStore.deletePlaylist(guildId, name);
            await interaction.reply({ content: `Deleted playlist **${name}**.`, ephemeral: false });
            return;
          }

          if (subCommand === 'remove') {
            if (!name) {
              await interaction.reply({ content: 'A playlist name is required.', ephemeral: true });
              return;
            }
            const index = interaction.options.getInteger('song');
            const removedSong = this.playlistStore.removeSong(guildId, name, index);
            await interaction.reply({ content: removedSong ? `Removed **${removedSong.title || removedSong}** from **${name}**.` : 'That song number does not exist.', ephemeral: false });
            return;
          }

          await interaction.reply({ content: 'Playlist subcommand not recognized.', ephemeral: true });
          break;
        }

        default:
          await interaction.reply({ content: `Unknown command: ${commandName}`, ephemeral: true });
      }
    } catch (error) {
      logger.error('Command execution failed:', error);
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: 'An error occurred while handling that command.', ephemeral: true });
      } else {
        await interaction.reply({ content: 'An error occurred while handling that command.', ephemeral: true });
      }
    }
  }

  startVoiceListener(player, guildId, guild) {
    if (!this.listenEnabled || !this.transcriber || this.transcriber.name === 'disabled') {
      return;
    }

    if (!this.voiceListeners.has(guildId)) {
      const listener = new VoiceListener({
        transcriber: this.transcriber,
        logger,
        wakePhrase: this.wakePhrase,
        onWakePhrase: () => logger.info('Wake phrase captured, ready for command processing.'),
        onRequestText: async (text) => {
          if (!text) return;
          const requestedTrack = await player.enqueue(text, 'voice');
          logger.info(`Voice request resolved: ${requestedTrack.title}`);
        },
      });

      const connection = guild?.voiceStates?.cache?.get(this.user.id)?.channel ? player.connection : null;
      if (connection) {
        listener.start(connection, this.user.id);
      }
      this.voiceListeners.set(guildId, listener);
    }
  }
}

module.exports = {
  AngelBot,
};
