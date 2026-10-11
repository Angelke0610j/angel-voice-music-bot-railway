const LOG_LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3,
};

const levelName = process.env.LOG_LEVEL || 'info';
const currentLevel = LOG_LEVELS[levelName] ?? LOG_LEVELS.info;

const format = (level, ...args) => {
  const time = new Date().toISOString();
  const prefix = `[Angel:${level.toUpperCase()} ${time}]`;
  console.log(prefix, ...args);
};

module.exports = {
  error: (...args) => currentLevel >= LOG_LEVELS.error && format('error', ...args),
  warn: (...args) => currentLevel >= LOG_LEVELS.warn && format('warn', ...args),
  info: (...args) => currentLevel >= LOG_LEVELS.info && format('info', ...args),
  debug: (...args) => currentLevel >= LOG_LEVELS.debug && format('debug', ...args),
};
