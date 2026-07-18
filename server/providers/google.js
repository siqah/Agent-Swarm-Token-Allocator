import { logger } from '../logger.js';

const BASE = 'https://generativelanguage.googleapis.com/v1beta';

export const name = 'google';

const KEY_STORE_KEY = 'google';

export function isAvailable() {
  return getKeys().length > 0;
}

export function getKeys() {
  if (global.__providerKeys && global.__providerKeys[KEY_STORE_KEY]) {
    return global.__providerKeys[KEY_STORE_KEY];
  }
  const env = process.env.GOOGLE_API_KEY;
  return env ? [env] : [];
}

export function getApiKey() {
  return getKeys()[0];
}

const MODEL_MAP = {
  'gemini-2.0-flash': 'gemini-2.0-flash',
  'gemini-2.0-pro': 'gemini-2.0-pro',
  'gemini-1.5-pro': 'gemini-1.5-pro',
  'gemini-1.5-flash': 'gemini-1.5-flash',
};

function mapModel(model) {
  return MODEL_MAP[model] || model;
}

function toGeminiContent(messages) {
  const geminiMessages = [];

  for (const msg of messages) {
    if (msg.role === 'system') continue;
    const role = msg.role === 'assistant' ? 'model' : 'user';
    geminiMessages.push({ role, parts: [{ text: msg.content }] });
  }

  // Gemini requires alternating user/model, starting with user
  return geminiMessages.length > 0 ? geminiMessages : [{ role: 'user', parts: [{ text: '' }] }];
}

function getSystemInstruction(messages) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  return system ? { parts: [{ text: system }] } : undefined;
}

export async function call({ model, messages, temperature, max_tokens, signal, key }) {
  const apiKey = key || getApiKey();
  const url = `${BASE}/models/${mapModel(model)}:generateContent?key=${apiKey}`;

  const body = {
    contents: toGeminiContent(messages),
    generationConfig: {},
  };
  if (temperature !== undefined) body.generationConfig.temperature = temperature;
  if (max_tokens !== undefined) body.generationConfig.maxOutputTokens = max_tokens;

  const sysInst = getSystemInstruction(messages);
  if (sysInst) body.systemInstruction = sysInst;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error(`[Google Error] ${response.status}:`, data.error);
    const err = new Error(data.error?.message || 'Google AI API error');
    err.statusCode = response.status;
    err.code = data.error?.code?.toString() || 'upstream_error';
    throw err;
  }

  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
  const usageMeta = data.usageMetadata || {};
  const inputTokens = usageMeta.promptTokenCount || 0;
  const outputTokens = usageMeta.candidatesTokenCount || 0;

  return {
    id: `gemini-${Date.now()}`,
    model: model,
    choices: [{
      index: 0,
      message: { role: 'assistant', content: text },
      finish_reason: (data.candidates?.[0]?.finishReason || 'stop').toLowerCase(),
    }],
    usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
  };
}

export async function* stream({ model, messages, temperature, max_tokens, signal, key }) {
  const apiKey = key || getApiKey();
  const url = `${BASE}/models/${mapModel(model)}:streamGenerateContent?alt=sse&key=${apiKey}`;

  const body = {
    contents: toGeminiContent(messages),
    generationConfig: {},
  };
  if (temperature !== undefined) body.generationConfig.temperature = temperature;
  if (max_tokens !== undefined) body.generationConfig.maxOutputTokens = max_tokens;

  const sysInst = getSystemInstruction(messages);
  if (sysInst) body.systemInstruction = sysInst;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const data = await response.json();
    logger.error(`[Google Stream Error] ${response.status}:`, data.error);
    const err = new Error(data.error?.message || 'Google AI API error');
    err.statusCode = response.status;
    err.code = data.error?.code?.toString() || 'upstream_error';
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
        try {
          const event = JSON.parse(payload);
          const text = event.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || '';
          const finishReason = event.candidates?.[0]?.finishReason || null;

          yield {
            choices: [{ index: 0, delta: { content: text }, finish_reason: finishReason ? finishReason.toLowerCase() : null }],
          };

          if (finishReason) {
            const usageMeta = event.usageMetadata || {};
            const inputTokens = usageMeta.promptTokenCount || 0;
            const outputTokens = usageMeta.candidatesTokenCount || 0;
            yield {
              choices: [{ index: 0, delta: {}, finish_reason: finishReason.toLowerCase() }],
              usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
            };
          }
        } catch {
          // skip malformed
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
