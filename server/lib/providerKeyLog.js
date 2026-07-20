// In-memory ring buffer for request logs
// This is a simple module that mirrors the structure of requestLog.js
// but is specifically for provider key validation events.

const MAX_LOG_ENTRIES = 500;
const logs = [];
let nextIndex = 0;

export function recordProviderKeyValidation(providerName, result) {
  const entry = {
    timestamp: new Date().toISOString(),
    provider: providerName,
    valid: result.valid,
    status: result.status || null,
    error: result.error || null,
  };
  logs[nextIndex] = entry;
  nextIndex = (nextIndex + 1) % MAX_LOG_ENTRIES;
}

export function getProviderKeyLogs() {
  const result = [];
  // Return in reverse chronological order
  for (let i = 0; i < logs.length; i++) {
    const idx = (nextIndex - 1 - i + MAX_LOG_ENTRIES) % MAX_LOG_ENTRIES;
    if (logs[idx]) result.push(logs[idx]);
  }
  return result;
}
