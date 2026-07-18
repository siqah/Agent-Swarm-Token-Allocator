import crypto from 'crypto';
import { logger } from './logger.js';

const SIMILARITY_THRESHOLD = parseFloat(process.env.CACHE_SIMILARITY_THRESHOLD) || 0.85;
const MAX_SEMANTIC_ENTRIES = parseInt(process.env.CACHE_MAX_ENTRIES, 10) || 500;
const EXACT_TTL_MS = parseInt(process.env.CACHE_EXACT_TTL_MS, 10) || 300_000;
const SEMANTIC_TTL_MS = parseInt(process.env.CACHE_SEMANTIC_TTL_MS, 10) || 600_000;

// ── Exact-match store ───────────────────────
const exactStore = new Map();
// ── Semantic store (embedding → response) ───
const semanticStore = [];

function embed(text) {
  // Character tri-gram frequency vector for lightweight semantic similarity
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

// Periodic cleanup
const CLEANUP_INTERVAL = 60_000;
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of exactStore) {
    if (now - entry.ts > EXACT_TTL_MS) exactStore.delete(key);
  }
  while (semanticStore.length > 0 && semanticStore[0] && (now - semanticStore[0].ts > SEMANTIC_TTL_MS)) {
    semanticStore.shift();
  }
}, CLEANUP_INTERVAL).unref();

export function checkCache(model, messages) {
  // 1. Exact match
  const exactKey = makeExactKey(model, messages);
  const exact = exactStore.get(exactKey);
  if (exact && (Date.now() - exact.ts < EXACT_TTL_MS)) {
    logger.info(`[Cache] Exact hit for ${model}`);
    return { hit: true, type: 'exact', response: exact.response };
  }

  // 2. Semantic match
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
  // 1. Exact
  const exactKey = makeExactKey(model, messages);
  exactStore.set(exactKey, { response, ts: Date.now() });

  // 2. Semantic (trim if over limit)
  const text = normalizeMessages(messages);
  const embedding = embed(text);
  semanticStore.push({ model, embedding, response, ts: Date.now() });

  if (semanticStore.length > MAX_SEMANTIC_ENTRIES) {
    semanticStore.splice(0, semanticStore.length - MAX_SEMANTIC_ENTRIES);
  }
}

export function clearCache() {
  exactStore.clear();
  semanticStore.length = 0;
}

export function getCacheStats() {
  return { exactSize: exactStore.size, semanticSize: semanticStore.length, threshold: SIMILARITY_THRESHOLD };
}
