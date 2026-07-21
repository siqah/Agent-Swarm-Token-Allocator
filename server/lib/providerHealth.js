import { logger } from './logger.js';

const PROVIDER_CHECKS = {
  openai: async (key) => {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    return { valid: res.ok, status: res.status };
  },
  anthropic: async (key) => {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'claude-3-haiku-20240307', max_tokens: 1, messages: [{ role: 'user', content: 'hi' }] }),
      signal: AbortSignal.timeout(10000),
    });
    return { valid: res.status === 429 || res.ok, status: res.status };
  },
  google: async (key) => {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts: [{ text: 'hi' }] }] }),
      signal: AbortSignal.timeout(10000),
    });
    return { valid: res.status === 429 || res.ok || res.status === 400, status: res.status };
  },
  groq: async (key) => {
    const res = await fetch('https://api.groq.com/openai/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(5000),
    });
    return { valid: res.ok, status: res.status };
  },
};

export async function validateProviderKey(providerName, apiKey) {
  const check = PROVIDER_CHECKS[providerName];
  if (!check) {
    logger.warn(`No health check available for provider '${providerName}'. Skipping validation.`);
    return { valid: true, message: `No validation available for '${providerName}'` };
  }
  try {
    const result = await check(apiKey);
    if (!result.valid) {
      logger.warn(`Provider key validation failed for '${providerName}': HTTP ${result.status}`);
    }
    return result;
  } catch (err) {
    logger.warn(`Provider key validation error for '${providerName}': ${err.message}`);
    return { valid: false, status: 0, error: err.message };
  }
}

async function checkProvider(providerName, keys) {
  if (!keys || keys.length === 0) return { name: providerName, available: false, keyCount: 0, error: null };
  try {
    const check = PROVIDER_CHECKS[providerName];
    if (!check) return { name: providerName, available: false, keyCount: keys.length, error: 'no health check' };
    const result = await check(keys[0]);
    return {
      name: providerName,
      available: result.valid,
      keyCount: keys.length,
      status: result.status,
      error: result.valid ? null : `HTTP ${result.status}`,
    };
  } catch (err) {
    return { name: providerName, available: false, keyCount: keys.length, error: err.message };
  }
}

export async function checkAllProviders() {
  const stored = global.__providerKeys || {};
  const results = [];
  for (const [name, keys] of Object.entries(stored)) {
    const result = await checkProvider(name, keys);
    results.push(result);
  }
  return results;
}
