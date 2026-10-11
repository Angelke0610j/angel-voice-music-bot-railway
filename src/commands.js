const { SlashCommandBuilder } = require('discord.js');

const commandDefinitions = [
  new SlashCommandBuilder().setName('join').setDescription('Join your current voice channel').toJSON(),
  new SlashCommandBuilder().setName('leave').setDescription('Disconnect and leave the voice channel').toJSON(),
  new SlashCommandBuilder().setName('status').setDescription('Report the bot status and current queue state').toJSON(),
  new SlashCommandBuilder()
    .setName('play')
    .setDescription('Search YouTube for a track and add it to the queue')
    .addStringOption((option) => option.setName('song').setDescription('Song title or lyric fragment to search').setRequired(true))
    .toJSON(),
  new SlashCommandBuilder().setName('skip').setDescription('Skip the current track').toJSON(),
  new SlashCommandBuilder().setName('stop').setDescription('Stop playback and clear the queue').toJSON(),
  new SlashCommandBuilder().setName('next').setDescription('Move to the next queued song').toJSON(),
  new SlashCommandBuilder().setName('previous').setDescription('Return to the previous track').toJSON(),
  new SlashCommandBuilder().setName('pause').setDescription('Pause playback').toJSON(),
  new SlashCommandBuilder().setName('resume').setDescription('Resume playback').toJSON(),
  new SlashCommandBuilder().setName('help').setDescription('Show available commands and usage').toJSON(),
  new SlashCommandBuilder().setName('settings').setDescription('Show the current bot configuration').toJSON(),
  new SlashCommandBuilder()
    .setName('listen')
    .setDescription('Enable or disable wake-word listening')
    .addBooleanOption((option) => option.setName('enabled').setDescription('Whether the bot should listen for wake words').setRequired(true))
    .toJSON(),
  new SlashCommandBuilder()
    .setName('playlist')
    .setDescription('Manage playlists')
    .addSubcommand((subcommand) =>
      subcommand
        .setName('list')
        .setDescription('Display saved playlists for this guild')
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('add')
        .setDescription('Add a song to a saved playlist')
        .addStringOption((option) => option.setName('name').setDescription('Playlist name').setRequired(true))
        .addStringOption((option) => option.setName('song').setDescription('Song title or YouTube URL').setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('view')
        .setDescription('Show songs in a saved playlist')
        .addStringOption((option) => option.setName('name').setDescription('Playlist name').setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('play')
        .setDescription('Queue and play a saved playlist')
        .addStringOption((option) => option.setName('name').setDescription('Playlist name').setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('delete')
        .setDescription('Delete a saved playlist')
        .addStringOption((option) => option.setName('name').setDescription('Playlist name').setRequired(true))
    )
    .addSubcommand((subcommand) =>
      subcommand
        .setName('remove')
        .setDescription('Remove a song from a playlist by number')
        .addStringOption((option) => option.setName('name').setDescription('Playlist name').setRequired(true))
        .addIntegerOption((option) => option.setName('song').setDescription('Song number to remove').setRequired(true))
    )
    .toJSON(),
];

module.exports = {
  commandDefinitions,
};
