import 'dotenv/config';
import { REST, Routes, SlashCommandBuilder } from 'discord.js';

const { DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID } = process.env;
if (!DISCORD_TOKEN || !DISCORD_CLIENT_ID || !DISCORD_GUILD_ID) {
  throw new Error('Set DISCORD_TOKEN, DISCORD_CLIENT_ID, and DISCORD_GUILD_ID in .env');
}

const commands = [
  new SlashCommandBuilder().setName('join').setDescription('Join your current voice channel and listen for the wake word'),
  new SlashCommandBuilder().setName('leave').setDescription('Leave voice and stop listening'),
  new SlashCommandBuilder().setName('listen').setDescription('Toggle voice-request listening')
    .addBooleanOption(o => o.setName('enabled').setDescription('Whether listening is enabled').setRequired(true)),
  new SlashCommandBuilder().setName('play').setDescription('Search the licensed Jamendo catalog and play a track')
    .addStringOption(o => o.setName('song').setDescription('Song title and artist').setRequired(true)),
  new SlashCommandBuilder().setName('stop').setDescription('Stop the current track'),
  new SlashCommandBuilder().setName('skip').setDescription('Skip the current track'),
].map(c => c.toJSON());

const rest = new REST({ version: '10' }).setToken(DISCORD_TOKEN);
await rest.put(Routes.applicationGuildCommands(DISCORD_CLIENT_ID, DISCORD_GUILD_ID), { body: commands });
console.log(`Registered ${commands.length} commands.`);
