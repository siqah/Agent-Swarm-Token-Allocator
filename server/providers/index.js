import * as openai from './openai.js';
import * as anthropic from './anthropic.js';
import * as google from './google.js';
import * as groq from './groq.js';

const PROVIDERS = [openai, anthropic, google, groq];

// Round-robin key index per provider
const keyIndex = {};

// Which provider handles which model prefix
const MODEL_ROUTES = [
  { prefix: 'gpt-', provider: openai.name },
  { prefix: 'o1-', provider: openai.name },
  { prefix: 'o3-', provider: openai.name },
  { prefix: 'claude', provider: anthropic.name },
  { prefix: 'gemini', provider: google.name },
  { prefix: 'llama', provider: groq.name },
  { prefix: 'mixtral', provider: groq.name },
  { prefix: 'deepseek', provider: groq.name },
];

function findProvider(name) {
  return PROVIDERS.find((p) => p.name === name);
}

// Sync provider keys from database into the global registry
export function syncProviderKeys(db) {
  const stored = db.get()?.providerKeys || {};
  global.__providerKeys = {};
  for (const provider of PROVIDERS) {
    const name = provider.name;
    // DB keys first, then env var fallback
    const dbKeys = stored[name] || [];
    const envKey = process.env[`${name.toUpperCase()}_API_KEY`];
    const allKeys = [...dbKeys];
    if (envKey && !allKeys.includes(envKey)) allKeys.push(envKey);
    global.__providerKeys[name] = allKeys;
  }
}

// Select a key for the provider using round-robin
export function selectKey(providerName) {
  const keys = global.__providerKeys?.[providerName] || [];
  if (keys.length === 0) return null;
  if (keys.length === 1) return keys[0];
  if (!keyIndex[providerName]) keyIndex[providerName] = 0;
  const idx = keyIndex[providerName] % keys.length;
  keyIndex[providerName] = (idx + 1) % keys.length;
  return keys[idx];
}

export function getProviderForModel(model) {
  for (const route of MODEL_ROUTES) {
    if (model.startsWith(route.prefix)) {
      const provider = findProvider(route.provider);
      if (provider && provider.isAvailable()) return provider;
    }
  }
  // fallback: try OpenAI if available
  if (openai.isAvailable()) return openai;
  return null;
}

export function getAvailableProviders() {
  return PROVIDERS.filter((p) => p.isAvailable()).map((p) => {
    const keys = global.__providerKeys?.[p.name] || [];
    return { name: p.name, keyCount: keys.length };
  });
}

// Fallback chain across providers: resolves a model string to a provider,
// or suggests the next compatible model/provider to try
const FALLBACK_PATHS = {
  'gpt-5.6-sol': ['gpt-5.6-terra', 'gpt-5.6-luna', 'gpt-5.4-nano'],
  'gpt-5.6-terra': ['gpt-5.6-luna', 'gpt-5.4-nano'],
  'gpt-5.6-luna': ['gpt-5.4-nano'],
  'gpt-5.4-nano': ['claude-3.5-haiku', 'gemini-1.5-flash', 'llama-3.1-8b'],
  'claude-3.5-sonnet': ['claude-3.5-haiku', 'gpt-5.6-luna', 'gemini-1.5-flash'],
  'claude-3.5-haiku': ['gpt-5.4-nano', 'llama-3.1-8b'],
  'claude-3-opus': ['claude-3.5-sonnet', 'gpt-5.6-terra'],
  'gemini-2.0-flash': ['gemini-1.5-flash', 'gpt-5.4-nano', 'llama-3.1-8b'],
  'gemini-2.0-pro': ['gemini-1.5-pro', 'claude-3.5-haiku', 'gpt-5.6-luna'],
  'gemini-1.5-pro': ['gemini-1.5-flash', 'gpt-5.4-nano'],
  'gemini-1.5-flash': ['gpt-5.4-nano', 'llama-3.1-8b'],
  'llama-3.3-70b': ['llama-3.1-8b', 'mixtral-8x7b', 'gpt-5.4-nano'],
  'llama-3.1-8b': ['gpt-5.4-nano'],
  'mixtral-8x7b': ['llama-3.1-8b', 'gpt-5.4-nano'],
  'deepseek-r1': ['llama-3.3-70b', 'gpt-5.6-luna'],
};

export function getFallbackChain(model) {
  return FALLBACK_PATHS[model] || [];
}

export { PROVIDERS, MODEL_ROUTES };
