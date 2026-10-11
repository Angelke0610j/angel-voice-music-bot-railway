import 'dotenv/config';
import OpenAI, { toFile } from 'openai';
import { Client, GatewayIntentBits, Events, MessageFlags } from 'discord.js';
import {
  joinVoiceChannel, getVoiceConnection, VoiceConnectionStatus,
  entersState, EndBehaviorType, createAudioPlayer
} from '@discordjs/voice';
import prism from 'prism-media';
import { createMusicManager } from './music.js';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

const required = ['DISCORD_TOKEN', 'OPENAI_API_KEY'];
for (const key of required) if (!process.env[key]) throw new Error(`Missing environment variable: ${key}`);

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates]
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const wakeWord = (process.env.WAKE_WORD || 'angel').toLowerCase().trim();
const musicByGuild = new Map();
const listeningByGuild = new Map();
const voiceTextByGuild = new Map();
const processingUsers = new Set();

function musicFor(guildId) {
  if (!musicByGuild.has(guildId)) musicByGuild.set(guildId, createMusicManager());
  return musicByGuild.get(guildId);
}
function sendStatus(guild, text) {
  const channelId = process.env.STATUS_CHANNEL_ID;
  const channel = channelId ? guild.channels.cache.get(channelId) : null;
  if (channel?.isTextBased()) channel.send(text).catch(() => {});
  else console.log(`[${guild.name}] ${text}`);
}
function getMemberVoiceChannel(interaction) {
  return interaction.member?.voice?.channel ?? null;
}
function pcmToWav(pcm, sampleRate = 48000, channels = 2) {
  const header = Buffer.alloc(44);
  const dataLength = pcm.length;
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * channels * 2, 28);
  header.writeUInt16LE(channels * 2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataLength, 40);
  return Buffer.concat([header, pcm]);
}
function rmsPcm16(buffer) {
  const samples = Math.floor(buffer.length / 2);
  if (!samples) return 0;
  let sum = 0;
  for (let i = 0; i < samples; i++) {
    const v = buffer.readInt16LE(i * 2) / 32768;
    sum += v * v;
  }
  return Math.sqrt(sum / samples);
}
function parseRequest(transcript) {
  const text = transcript.toLowerCase();
  const idx = text.indexOf(wakeWord);
  if (idx < 0) return null;
  const after = transcript.slice(idx + wakeWord.length).replace(/^[\s,.:;!?-]+/, '').trim();
  if (!after) return { action: 'help' };
  if (/^(stop|stop the music|shut up)\b/i.test(after)) return { action: 'stop' };
  if (/^(skip|next)\b/i.test(after)) return { action: 'skip' };
  const song = after.replace(/^(please\s+)?(play|find|search for|put on)\s+/i, '').trim();
  if (!song || song.length < 2) return { action: 'help' };
  return { action: 'play', song };
}
async function transcribePcm(pcm) {
  const wav = pcmToWav(pcm);
  const filename = path.join(os.tmpdir(), `angel-${randomUUID()}.wav`);
  await fs.writeFile(filename, wav);
  try {
    const audioFile = await toFile(await fs.readFile(filename), 'speech.wav', { type: 'audio/wav' });
    const response = await openai.audio.transcriptions.create({
      file: audioFile,
      model: 'gpt-4o-mini-transcribe',
      ...(process.env.TRANSCRIPTION_LANGUAGE ? { language: process.env.TRANSCRIPTION_LANGUAGE } : {})
    });
    return response.text || '';
  } finally {
    await fs.unlink(filename).catch(() => {});
  }
}
async function handleTranscript(guild, userId, transcript) {
  if (!transcript) return;
  console.log(`[speech:${guild.id}:${userId}] ${transcript}`);
  const request = parseRequest(transcript);
  if (!request) return;
  if (request.action === 'help') {
    sendStatus(guild, `I heard my wake word. Say “${wakeWord}, play [song and artist]”, “${wakeWord}, skip”, or “${wakeWord}, stop”.`);
    return;
  }
  const music = musicFor(guild.id);
  if (request.action === 'stop') {
    music.stop();
    sendStatus(guild, 'Stopped playback.');
  } else if (request.action === 'skip') {
    if (!music.skip()) sendStatus(guild, 'Nothing is playing right now.');
  } else if (request.action === 'play') {
    sendStatus(guild, `Searching the licensed Jamendo catalog for “${request.song}”…`);
    try {
      const track = await music.enqueue(request.song);
      sendStatus(guild, `Queued: **${track.name} — ${track.artist}**. Track: ${track.page}\nLicense: ${track.license}`);
    } catch (err) {
      sendStatus(guild, `I couldn't play that request: ${err.message}`);
    }
  }
}
function listenToVoice(connection, guild) {
  const receiver = connection.receiver;
  receiver.speaking.on('start', userId => {
    if (userId === client.user.id || processingUsers.has(`${guild.id}:${userId}`)) return;
    const key = `${guild.id}:${userId}`;
    processingUsers.add(key);
    const opus = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: 900 }
    });
    const decoder = new prism.opus.Decoder({ rate: 48000, channels: 2, frameSize: 960 });
    const chunks = [];
    let totalBytes = 0;
    let silenceMs = 0;
    let speechMs = 0;
    let finished = false;

    const finish = async () => {
      if (finished) return;
      finished = true;
      processingUsers.delete(key);
      decoder.destroy();
      if (speechMs < 500 || totalBytes < 12000) return;
      const pcm = Buffer.concat(chunks);
      try {
        const transcript = await transcribePcm(pcm);
        await handleTranscript(guild, userId, transcript);
      } catch (err) {
        console.error('Transcription error:', err.message);
      }
    };

    opus.pipe(decoder);
    decoder.on('data', chunk => {
      if (finished) return;
      // A 20 ms stereo 48 kHz PCM frame is approximately 3,840 bytes.
      chunks.push(chunk);
      totalBytes += chunk.length;
      const loud = rmsPcm16(chunk) > 0.012;
      if (loud) { speechMs += 20; silenceMs = 0; }
      else silenceMs += 20;
      if (silenceMs > 1200 || totalBytes > 48_000 * 2 * 2 * 12) {
        opus.destroy();
        finish();
      }
    });
    opus.on('end', finish);
    opus.on('error', () => finish());
    decoder.on('error', () => finish());
  });
}

client.once(Events.ClientReady, ready => {
  console.log(`Logged in as ${ready.user.tag}. Wake word: "${wakeWord}"`);
});
client.on(Events.InteractionCreate, async interaction => {
  if (!interaction.isChatInputCommand()) return;
  const guild = interaction.guild;
  if (!guild) return interaction.reply({ content: 'Use this command in a server.', flags: MessageFlags.Ephemeral });
  const command = interaction.commandName;

  if (command === 'join') {
    const channel = getMemberVoiceChannel(interaction);
    if (!channel) return interaction.reply({ content: 'Join a voice channel first.', flags: MessageFlags.Ephemeral });
    if (process.env.ALLOWED_VOICE_CHANNEL_ID && channel.id !== process.env.ALLOWED_VOICE_CHANNEL_ID) {
      return interaction.reply({ content: 'This voice channel is not allowed for this bot.', flags: MessageFlags.Ephemeral });
    }
    const old = getVoiceConnection(guild.id);
    old?.destroy();
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: guild.id,
      adapterCreator: guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });
    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 20_000);
      connection.subscribe(musicFor(guild.id).player);
      listeningByGuild.set(guild.id, true);
      listenToVoice(connection, guild);
      connection.on(VoiceConnectionStatus.Disconnected, () => {
        console.warn(`Voice connection disconnected in ${guild.name}`);
      });
      await interaction.reply(`Joined **${channel.name}**. Listening for “${wakeWord}” while connected. Audio is transcribed after each detected speech segment; don't use this without telling members.`);
    } catch (err) {
      connection.destroy();
      await interaction.reply({ content: `Could not connect to voice: ${err.message}`, flags: MessageFlags.Ephemeral });
    }
  } else if (command === 'leave') {
    getVoiceConnection(guild.id)?.destroy();
    listeningByGuild.set(guild.id, false);
    musicFor(guild.id).stop();
    await interaction.reply('Left voice and stopped listening.');
  } else if (command === 'listen') {
    const enabled = interaction.options.getBoolean('enabled', true);
    listeningByGuild.set(guild.id, enabled);
    if (!enabled) {
      getVoiceConnection(guild.id)?.destroy();
      musicFor(guild.id).stop();
      await interaction.reply('Listening disabled; disconnected from voice.');
    } else {
      await interaction.reply('Listening is enabled. Use `/join` while you are in your voice channel to connect.');
    }
  } else if (command === 'play') {
    const query = interaction.options.getString('song', true);
    await interaction.deferReply();
    try {
      const track = await musicFor(guild.id).enqueue(query);
      const connection = getVoiceConnection(guild.id);
      if (connection) connection.subscribe(musicFor(guild.id).player);
      await interaction.editReply(`Queued **${track.name} — ${track.artist}**\n${track.page}\nLicense: ${track.license}`);
    } catch (err) {
      await interaction.editReply(`Search/playback failed: ${err.message}`);
    }
  } else if (command === 'stop') {
    musicFor(guild.id).stop();
    await interaction.reply('Stopped playback.');
  } else if (command === 'skip') {
    const skipped = musicFor(guild.id).skip();
    await interaction.reply(skipped ? 'Skipped.' : 'Nothing is playing.');
  }
});
client.on(Events.VoiceStateUpdate, (oldState, newState) => {
  if (oldState.id === client.user?.id && oldState.channelId && !newState.channelId) {
    listeningByGuild.set(oldState.guild.id, false);
  }
});
process.on('unhandledRejection', err => console.error('Unhandled rejection:', err));
process.on('SIGTERM', () => {
  for (const [guildId] of musicByGuild) musicByGuild.get(guildId).stop();
  client.destroy();
  process.exit(0);
});
await client.login(process.env.DISCORD_TOKEN);
