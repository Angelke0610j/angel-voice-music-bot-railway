const { AngelBot } = require('./bot');
const config = require('./config');
const logger = require('./logger');

const bot = new AngelBot();

bot.login(config.DISCORD_TOKEN).catch((error) => {
  logger.error('Bot startup failed:', error.message || error);
  process.exit(1);
});

process.on('SIGINT', () => {
  logger.info('Shutting down Angel Music Bot...');
  process.exit(0);
});
