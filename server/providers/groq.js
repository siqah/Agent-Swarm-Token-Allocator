import { logger } from '../lib/logger.js';

const BASE = 'https://api.groq.com/openai/v1';

export const name = 'groq';

const KEY_STORE_KEY = 'groq';

export function isAvailable() {
  return getKeys().length > 0;
}

export function getKeys() {
  if (global.__providerKeys && global.__providerKeys[KEY_STORE_KEY]) {
    return global.__providerKeys[KEY_STORE_KEY];
  }
  const env = process.env.GROQ_API_KEY;
  return env ? [env] : [];
}

export function getApiKey() {
  return getKeys()[0];
}

const MODEL_MAP = {
  'llama-3.3-70b': 'llama-3.3-70b-versatile',
  'llama-3.1-8b': 'llama-3.1-8b-instant',
  'mixtral-8x7b': 'mixtral-8x7b-32768',
  'deepseek-r1': 'deepseek-r1-distill-llama-70b',
};

function mapModel(model) {
  return MODEL_MAP[model] || model;
}

export async function call({ model, messages, temperature, max_tokens, signal, key }) {
  const body = { model: mapModel(model), messages };
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
    logger.error(`[Groq Error] ${response.status}:`, data.error);
    const err = new Error(data.error?.message || 'Groq API error');
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
    model: mapModel(model),
    messages,
    stream: true,
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
    logger.error(`[Groq Stream Error] ${response.status}:`, data.error);
    const err = new Error(data.error?.message || 'Groq API error');
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
          // skip malformed
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
