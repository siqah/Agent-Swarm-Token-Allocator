const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = process.env.TEST_MODE
  ? 99
  : (LOG_LEVELS[process.env.LOG_LEVEL] ?? 1);
const USE_JSON = process.env.LOG_FORMAT === 'json' || process.env.NODE_ENV === 'production';

function timestamp() {
  return new Date().toISOString();
}

function formatEntry(level, args) {
  if (USE_JSON) {
    return JSON.stringify({
      timestamp: timestamp(),
      level,
      message: args.map(String).join(' '),
    }) + '\n';
  }
  return `[${timestamp()}] [${level}] ${args.map(String).join(' ')}\n`;
}

export const logger = {
  debug: (...args) => {
    if (CURRENT_LEVEL > LOG_LEVELS.debug) return;
    process.stdout.write(formatEntry('DEBUG', args));
  },
  info: (...args) => {
    if (CURRENT_LEVEL > LOG_LEVELS.info) return;
    process.stdout.write(formatEntry('INFO', args));
  },
  warn: (...args) => {
    if (CURRENT_LEVEL > LOG_LEVELS.warn) return;
    process.stdout.write(formatEntry('WARN', args));
  },
  error: (...args) => {
    if (CURRENT_LEVEL > LOG_LEVELS.error) return;
    process.stderr.write(formatEntry('ERROR', args));
  },
};
