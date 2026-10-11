# Angel Voice Music Bot (Railway)

A starter Discord bot that joins a voice channel, receives speech, transcribes each speech segment, and reacts when it hears the configured wake word (default: `angel`). It can search/play tracks returned by the Jamendo API and includes slash-command fallbacks.

## Important limitations

- Discord voice **receiving** is not an officially documented/stable Discord API feature; `@discordjs/voice` explicitly warns that support is not guaranteed. Audio receive can break when Discord changes voice internals.
- This starter uses speech-to-text after detected speech segments. That means speech audio is sent to OpenAI for transcription and API billing may apply. Tell everyone in the VC before enabling it. It does not intentionally save recordings, but temporary WAV files are created and deleted during transcription.
- Jamendo is used as the playback catalog because a search result alone is not permission to stream copyrighted music. Obtain a Jamendo API client ID and check the license/usage terms for every track. Catalog availability and API permissions may vary.
- YouTube is **search-only in this starter**: it does not extract or rip YouTube audio. The YouTube Data API requires an API key and does not itself provide a playable audio stream. Do not bypass platform restrictions or play content unless you have the rights and the source permits it.
- The bot is a prototype. Test with a small private server before using it with a larger community.

## Architecture

1. Discord gateway handles slash commands and voice states.
2. `/join` connects to the caller's current voice channel with `selfDeaf: false`.
3. `@discordjs/voice` receiver gets each speaker's Opus packets; `prism-media` decodes them to 48 kHz PCM.
4. A silence detector groups speech into short segments.
5. OpenAI transcription converts the segment to text. If the configured wake word occurs, the bot parses `play`, `skip`, or `stop`.
6. Jamendo API searches tracks; the returned audio URL is streamed into the Discord voice player.
7. Railway runs the Node.js process as a persistent service.

## Commands

- `/join` — join your current voice channel and listen for the wake word.
- `/leave` — disconnect and stop playback.
- `/listen enabled:true|false` — enable/disable listening (disabling disconnects).
- `/play song:"artist - title"` — search and play a Jamendo result.
- `/skip` — skip the current track.
- `/stop` — stop playback and clear the queue.

Voice phrases:
- `Angel, play [song title] by [artist]`
- `Angel, skip`
- `Angel, stop`

## 1. Create the Discord application

1. Go to https://discord.com/developers/applications and create an application.
2. Open **Bot** and create/reset the bot token. Keep it secret.
3. Under **Installation** or **OAuth2 URL Generator**, add scopes `bot` and `applications.commands`.
4. Give it permissions to view channels, send messages, connect, and speak. Use the generated invite URL to add it to your server.
5. Copy the Application ID as `DISCORD_CLIENT_ID`.
6. Copy your server ID (enable Developer Mode in Discord, then right-click server > Copy Server ID) as `DISCORD_GUILD_ID`.
7. You do not need the privileged Message Content intent for these slash commands. Do not expose the bot token.

## 2. Obtain API keys

- Create an OpenAI API key at https://platform.openai.com/api-keys. API usage is billed separately from a ChatGPT subscription.
- Register an app at https://developer.jamendo.com/ and copy its client ID.
- If you want YouTube title/artist search too, create a YouTube Data API key in Google Cloud Console. This starter doesn't include YouTube search playback; adding metadata-only YouTube search is a separate extension and still won't provide a playable stream.

## 3. Run locally first (recommended)

Install Node.js 22.12+ and Git. Extract the ZIP, open a terminal in the project folder:

```bash
cp .env.example .env
npm install
```

Edit `.env` with your tokens/IDs. Then register the slash commands and start the bot:

```bash
npm run register
npm start
```

In Discord, join a voice channel and use `/join`. Test `Angel, play [song] by [artist]`, `/play`, `/skip`, and `/leave`.

## 4. Deploy to Railway

1. Push the extracted project folder to a **private GitHub repository**. Do not commit `.env`.
2. In Railway, create a project and choose **Deploy from GitHub Repo**; select the repository.
3. Railway detects the `Dockerfile` and builds the service. It runs `npm start` as a persistent process.
4. In the service's **Variables** tab, add every required value from `.env.example`: `DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID`, `OPENAI_API_KEY`, `WAKE_WORD`, `TRANSCRIPTION_LANGUAGE`, and `JAMENDO_CLIENT_ID`. `ALLOWED_VOICE_CHANNEL_ID` and `STATUS_CHANNEL_ID` are optional.
5. Deploy and check **Deployments > Logs**. You should see `Logged in as ...`.
6. Run slash-command registration once. Easiest: on your computer, copy `.env.example` to `.env`, fill the same values, run `npm install`, then `npm run register`. Alternatively, temporarily add a one-off Railway command/service with `npm run register`; remove it after registration.
7. Invite the bot using the URL from step 1. In your server, join a voice channel and run `/join`.
8. To deploy updates, push commits to the connected branch; Railway will rebuild and redeploy.

## Troubleshooting

- **Bot joins but doesn't hear anyone:** ensure it is not server-deafened; `/join` uses `selfDeaf: false`. Audio receive is experimental/unsupported and may fail after Discord changes.
- **Transcription fails:** check `OPENAI_API_KEY`, API billing/limits, network access, and Railway logs.
- **No track found:** add a valid `JAMENDO_CLIENT_ID`; try a different title/artist. Jamendo does not contain every commercial song.
- **Bot cannot speak:** ensure it has Connect/Speak permissions and is not server-muted.
- **Commands don't show:** run `npm run register` again and verify `DISCORD_CLIENT_ID` and `DISCORD_GUILD_ID`.
- **Railway restarts:** inspect logs and usage; this is a long-running service and can incur Railway usage charges.

## Privacy

The bot processes speech segments from every audible member while connected, not only speech that contains the wake word, because it must transcribe speech to discover the wake word. Inform members before using it. To reduce privacy impact, leave the bot disconnected until needed, use a dedicated channel, and disconnect with `/leave` when done.
