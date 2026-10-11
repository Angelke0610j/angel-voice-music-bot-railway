const dotenv = require('dotenv');

dotenv.config();

const toBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
};

module.exports = {
  DISCORD_TOKEN: process.env.DISCORD_TOKEN || '',
  CLIENT_ID: process.env.CLIENT_ID || '',
  GUILD_ID: process.env.GUILD_ID || '',
  WAKE_PHRASE: process.env.WAKE_PHRASE || 'Hey Angel',
  LISTEN_ENABLED: toBoolean(process.env.LISTEN_ENABLED, true),
  TRANSCRIPTION_PROVIDER: process.env.TRANSCRIPTION_PROVIDER || 'disabled',
  GEMINI_API_KEY: process.env.GEMINI_API_KEY || '',
  WHISPER_CPP_BIN: process.env.WHISPER_CPP_BIN || '',
  DEFAULT_VOLUME: Number(process.env.DEFAULT_VOLUME || 0.35),
  SEARCH_LIMIT: Number(process.env.SEARCH_LIMIT || 5),
  PLAYLIST_STORE_FILE: process.env.PLAYLIST_STORE_FILE || 'data/playlists.json',
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  COMMAND_PREFIX: process.env.COMMAND_PREFIX || '/',
};
