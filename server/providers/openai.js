import { logger } from '../lib/logger.js';

const BASE = 'https://api.openai.com/v1';

export const name = 'openai';

const KEY_STORE_KEY = 'openai';

export function isAvailable() {
  return getKeys().length > 0;
}

export function getKeys() {
  // Keys are injected by the provider index from DB + env vars
  if (global.__providerKeys && global.__providerKeys[KEY_STORE_KEY]) {
    return global.__providerKeys[KEY_STORE_KEY];
  }
  const env = process.env.OPENAI_API_KEY;
  return env ? [env] : [];
}

export function getApiKey() {
  return getKeys()[0];
}

export async function call({ model, messages, temperature, max_tokens, signal, key }) {
  const body = { model, messages };
  if (temperature !== undefined) body.temperature = temperature;
  if (max_tokens !== undefined) body.max_tokens = max_tokens;

  const apiKey = key || getApiKey();

  const response = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error(`[OpenAI Error] ${response.status}:`, data.error);
    const err = new Error(data.error?.message || 'OpenAI API error');
    err.statusCode = response.status;
    err.code = data.error?.code || 'upstream_error';
    throw err;
  }

  return {
    id: data.id,
    model: data.model,
    choices: data.choices.map((c) => ({
      index: c.index,
      message: c.message,
      finish_reason: c.finish_reason,
    })),
    usage: data.usage,
  };
}

export async function* stream({ model, messages, temperature, max_tokens, signal, key }) {
  const body = {
    model,
    messages,
    stream: true,
    stream_options: { include_usage: true },
  };
  if (temperature !== undefined) body.temperature = temperature;
  if (max_tokens !== undefined) body.max_tokens = max_tokens;

  const apiKey = key || getApiKey();

  const response = await fetch(`${BASE}/chat/completions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const data = await response.json();
    logger.error(`[OpenAI Stream Error] ${response.status}:`, data.error);
    const err = new Error(data.error?.message || 'OpenAI API error');
    err.statusCode = response.status;
    err.code = data.error?.code || 'upstream_error';
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const payload = trimmed.slice(6);
        if (payload === '[DONE]') return;
        try {
          yield JSON.parse(payload);
        } catch {
          // skip malformed chunks
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
