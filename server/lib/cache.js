import crypto from 'crypto';
import { logger } from './logger.js';

const SIMILARITY_THRESHOLD = parseFloat(process.env.CACHE_SIMILARITY_THRESHOLD) || 0.85;
const MAX_SEMANTIC_ENTRIES = parseInt(process.env.CACHE_MAX_ENTRIES, 10) || 500;
const EXACT_TTL_MS = parseInt(process.env.CACHE_EXACT_TTL_MS, 10) || 300_000;
const SEMANTIC_TTL_MS = parseInt(process.env.CACHE_SEMANTIC_TTL_MS, 10) || 600_000;
const MAX_RESPONSE_SIZE = parseInt(process.env.CACHE_MAX_RESPONSE_SIZE, 10) || 100_000;

const exactStore = new Map();
const semanticStore = [];

let cleanupTimer = null;

function embed(text) {
  const grams = {};
  for (let i = 0; i < text.length - 2; i++) {
    const g = text.slice(i, i + 3);
    grams[g] = (grams[g] || 0) + 1;
  }
  return grams;
}

function cosineSimilarity(a, b) {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, normA = 0, normB = 0;
  for (const k of keys) {
    const va = a[k] || 0;
    const vb = b[k] || 0;
    dot += va * vb;
    normA += va * va;
    normB += vb * vb;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

function normalizeMessages(messages) {
  return messages.map((m) => `${m.role}:${m.content}`).join(' ||| ');
}

function makeExactKey(model, messages) {
  const text = model + '::' + normalizeMessages(messages);
  return crypto.createHash('md5').update(text).digest('hex');
}

function responseSize(response) {
  try {
    return Buffer.byteLength(JSON.stringify(response), 'utf8');
  } catch {
    return 0;
  }
}

function startCleanup() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of exactStore) {
      if (now - entry.ts > EXACT_TTL_MS) exactStore.delete(key);
    }
    while (semanticStore.length > 0 && semanticStore[0] && (now - semanticStore[0].ts > SEMANTIC_TTL_MS)) {
      semanticStore.shift();
    }
  }, 60_000);
  cleanupTimer.unref();
}

function stopCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

export function checkCache(model, messages) {
  const exactKey = makeExactKey(model, messages);
  const exact = exactStore.get(exactKey);
  if (exact && (Date.now() - exact.ts < EXACT_TTL_MS)) {
    logger.info(`[Cache] Exact hit for ${model}`);
    return { hit: true, type: 'exact', response: exact.response };
  }

  const text = normalizeMessages(messages);
  const queryVec = embed(text);

  for (const entry of semanticStore) {
    if (entry.model !== model) continue;
    if (Date.now() - entry.ts > SEMANTIC_TTL_MS) continue;
    const sim = cosineSimilarity(queryVec, entry.embedding);
    if (sim >= SIMILARITY_THRESHOLD) {
      logger.info(`[Cache] Semantic hit for ${model} (similarity: ${sim.toFixed(3)})`);
      return { hit: true, type: 'semantic', similarity: sim, response: entry.response };
    }
  }

  return { hit: false };
}

export function setCache(model, messages, response) {
  if (responseSize(response) > MAX_RESPONSE_SIZE) {
    logger.warn(`[Cache] Response too large (${responseSize(response)} bytes), skipping cache for ${model}`);
    return;
  }

  const exactKey = makeExactKey(model, messages);
  exactStore.set(exactKey, { response, ts: Date.now() });

  const text = normalizeMessages(messages);
  const embedding = embed(text);
  semanticStore.push({ model, embedding, response, ts: Date.now() });

  if (semanticStore.length > MAX_SEMANTIC_ENTRIES) {
    semanticStore.splice(0, semanticStore.length - MAX_SEMANTIC_ENTRIES);
  }

  startCleanup();
}

export function clearCache() {
  exactStore.clear();
  semanticStore.length = 0;
  stopCleanup();
}

export function getCacheStats() {
  return { exactSize: exactStore.size, semanticSize: semanticStore.length, threshold: SIMILARITY_THRESHOLD };
}

export function getCacheCleanup() {
  return { start: startCleanup, stop: stopCleanup };
}
