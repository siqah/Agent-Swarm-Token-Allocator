import { logger } from '../logger.js';

const BASE = 'https://api.anthropic.com/v1';

export const name = 'anthropic';

const KEY_STORE_KEY = 'anthropic';

export function isAvailable() {
  return getKeys().length > 0;
}

export function getKeys() {
  if (global.__providerKeys && global.__providerKeys[KEY_STORE_KEY]) {
    return global.__providerKeys[KEY_STORE_KEY];
  }
  const env = process.env.ANTHROPIC_API_KEY;
  return env ? [env] : [];
}

export function getApiKey() {
  return getKeys()[0];
}

function toAnthropicMessages(messages) {
  const system = messages.filter((m) => m.role === 'system').map((m) => m.content).join('\n');
  const msgs = messages.filter((m) => m.role !== 'system');

  const converted = msgs.map((m) => {
    if (m.role === 'assistant') return { role: 'assistant', content: m.content };
    if (m.role === 'user') return { role: 'user', content: m.content };
    if (m.role === 'tool') return { role: 'user', content: m.content };
    return m;
  });

  return { system: system || undefined, messages: converted };
}

const MODEL_MAP = {
  'claude-3.5-sonnet': 'claude-3-5-sonnet-20241022',
  'claude-3.5-haiku': 'claude-3-5-haiku-20241022',
  'claude-3-opus': 'claude-3-opus-20240229',
};

function mapModel(model) {
  return MODEL_MAP[model] || model;
}

export async function call({ model, messages, temperature, max_tokens, signal, key }) {
  const { system, messages: msgs } = toAnthropicMessages(messages);
  const body = { model: mapModel(model), max_tokens: max_tokens || 4096, messages: msgs };
  if (system) body.system = system;
  if (temperature !== undefined) body.temperature = temperature;

  const apiKey = key || getApiKey();

  const response = await fetch(`${BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal,
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error(`[Anthropic Error] ${response.status}:`, data.error);
    const err = new Error(data.error?.message || 'Anthropic API error');
    err.statusCode = response.status;
    err.code = data.error?.type || 'upstream_error';
    throw err;
  }

  const inputTokens = data.usage?.input_tokens || 0;
  const outputTokens = data.usage?.output_tokens || 0;

  return {
    id: data.id,
    model: data.model,
    choices: [{
      index: 0,
      message: { role: 'assistant', content: data.content?.[0]?.text || '' },
      finish_reason: data.stop_reason === 'end_turn' ? 'stop' : data.stop_reason || 'stop',
    }],
    usage: { prompt_tokens: inputTokens, completion_tokens: outputTokens, total_tokens: inputTokens + outputTokens },
  };
}

export async function* stream({ model, messages, temperature, max_tokens, signal, key }) {
  const { system, messages: msgs } = toAnthropicMessages(messages);
  const body = { model: mapModel(model), max_tokens: max_tokens || 4096, messages: msgs, stream: true };
  if (system) body.system = system;
  if (temperature !== undefined) body.temperature = temperature;

  const apiKey = key || getApiKey();

  const response = await fetch(`${BASE}/messages`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    const data = await response.json();
    logger.error(`[Anthropic Stream Error] ${response.status}:`, data.error);
    const err = new Error(data.error?.message || 'Anthropic API error');
    err.statusCode = response.status;
    err.code = data.error?.type || 'upstream_error';
    throw err;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let content = '';
  let stopReason = null;

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
          const event = JSON.parse(payload);
          if (event.type === 'content_block_delta' && event.delta?.text) {
            content += event.delta.text;
            yield {
              choices: [{ index: 0, delta: { content: event.delta.text }, finish_reason: null }],
            };
          }
          if (event.type === 'message_delta' && event.delta?.stop_reason) {
            stopReason = event.delta.stop_reason;
          }
          if (event.type === 'message_stop') {
            // Final usage info may appear; if not, estimate
          }
        } catch {
          // skip malformed
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Emit final chunk with usage estimate (Anthropic doesn't stream usage natively)
  const inputTokens = 0; // not available from stream
  const outputTokens = content.length / 4; // rough estimate
  yield {
    choices: [{ index: 0, delta: {}, finish_reason: stopReason === 'end_turn' ? 'stop' : (stopReason || 'stop') }],
    usage: { prompt_tokens: inputTokens, completion_tokens: Math.ceil(outputTokens), total_tokens: Math.ceil(outputTokens) },
  };
}
