const LOG_LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };
const CURRENT_LEVEL = process.env.TEST_MODE
  ? 99
  : (LOG_LEVELS[process.env.LOG_LEVEL] ?? 1);

function timestamp() {
  return new Date().toISOString();
}

export const logger = {
  debug: (...args) => {
    if (CURRENT_LEVEL > 0) return;
    process.stdout.write(`[${timestamp()}] [DEBUG] ${args.map(String).join(' ')}\n`);
  },
  info: (...args) => {
    if (CURRENT_LEVEL > 1) return;
    process.stdout.write(`[${timestamp()}] [INFO] ${args.map(String).join(' ')}\n`);
  },
  warn: (...args) => {
    if (CURRENT_LEVEL > 2) return;
    process.stdout.write(`[${timestamp()}] [WARN] ${args.map(String).join(' ')}\n`);
  },
  error: (...args) => {
    if (CURRENT_LEVEL > 3) return;
    process.stderr.write(`[${timestamp()}] [ERROR] ${args.map(String).join(' ')}\n`);
  },
};
