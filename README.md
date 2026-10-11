# Angel Music Bot

Angel Music Bot is a Discord music bot designed for private communities and Railway deployment. It supports voice-channel joining, queue-based playback, playlist persistence, wake-word listening hooks, and modular transcription providers.

## Features

- `/join`, `/leave`, `/status`
- `/play`, `/skip`, `/next`, `/previous`, `/stop`, `/pause`, `/resume`
- `/playlist` subcommands for list/add/view/play/delete/remove
- persistent playlist storage in JSON on disk
- configurable local Whisper or Gemini transcription for voice wake-word detection
- Dockerfile plus Railway configuration for deployment

## Quick start

1. Copy `.env.example` to `.env` and fill in your Discord values. To enable Gemini transcription, set `TRANSCRIPTION_PROVIDER=gemini` and add a newly generated key as `GEMINI_API_KEY`.
2. Install dependencies with Node.js 20+.
3. Run:

```bash
npm install
npm start
```

## Environment variables

- `DISCORD_TOKEN`: Discord application token
- `CLIENT_ID`: Discord app client ID
- `GUILD_ID`: optional guild ID for guild-scoped command registration
- `WAKE_PHRASE`: default wake phrase; default is `Hey Angel`
- `LISTEN_ENABLED`: enable or disable voice listening
- `TRANSCRIPTION_PROVIDER`: `disabled`, `local-whisper`, or `gemini`
- `GEMINI_API_KEY`: API key for Gemini transcription; required when `TRANSCRIPTION_PROVIDER=gemini`
- `WHISPER_CPP_BIN`: optional path to a local Whisper binary
- `PLAYLIST_STORE_FILE`: persistent JSON storage location
- `DEFAULT_VOLUME`: default audio player volume

## Railway deployment

Use the included Dockerfile and `railway.json` to deploy the bot to Railway. Connect the service to your GitHub repository and set the environment variables from `.env.example` in the Railway dashboard.

## Important notes

- This project uses YouTube search and audio retrieval. You must ensure all content and playback follow the applicable YouTube ToS and the permissions for your content use cases.
- Actual wake-word recognition depends on a configured transcription provider and a real Discord voice connection. Set `TRANSCRIPTION_PROVIDER=gemini` and provide `GEMINI_API_KEY` to use Gemini audio transcription. Voice audio is sent to the Gemini API for processing.
- A disabled transcription provider keeps the bot connected and playable, but voice wake-word detection remains inactive until you configure a local transcription backend.

## Project structure

```text
src/
  bot.js
  commands.js
  config.js
  index.js
  logger.js
  music/
    player.js
    queue.js
    search.js
  storage/
    playlistStore.js
  transcription/
    transcriber.js
  voice/
    listener.js
```
