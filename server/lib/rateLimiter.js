import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import { logger } from './logger.js';

const REDIS_URL = process.env.REDIS_URL || null;

// Per-swarm-key rate limiting: separate store that keys on the swarm key value
const SWARM_KEY_RATE_LIMIT = parseInt(process.env.SWARM_KEY_RATE_LIMIT, 10) || 60; // req/min per key

let redisClient = null;

async function getRedisClient() {
  if (redisClient) return redisClient;
  if (!REDIS_URL) return null;
  try {
    redisClient = createClient({ url: REDIS_URL });
    redisClient.on('error', (err) => logger.warn('Redis rate limiter error:', err.message));
    await redisClient.connect();
    logger.info('Redis-backed rate limiter active.');
    return redisClient;
  } catch (err) {
    logger.warn(`Redis unavailable (${err.message}). Falling back to in-memory rate limiting.`);
    redisClient = null;
    return null;
  }
}

// Express-rate-limit store interface backed by Redis
class RedisStore {
  async init(options) {
    this.windowMs = options.windowMs;
    if (!this.prefix) this.prefix = 'rl:';
    this.client = await getRedisClient();
  }

  async increment(key) {
    if (!this.client) return { totalHits: 1, resetTime: null };
    const redisKey = this.prefix + key;
    const totalHits = await this.client.incr(redisKey);
    if (totalHits === 1) {
      await this.client.pexpire(redisKey, this.windowMs);
    }
    const pttl = await this.client.pttl(redisKey);
    const resetTime = pttl > 0 ? Date.now() + pttl : Date.now() + this.windowMs;
    return { totalHits, resetTime: new Date(resetTime) };
  }

  async decrement(key) {
    if (!this.client) return;
    await this.client.decr(this.prefix + key);
  }

  async resetKey(key) {
    if (!this.client) return;
    await this.client.del(this.prefix + key);
  }

  async resetAll() {
    if (!this.client) return;
    const keys = await this.client.keys(this.prefix + '*');
    if (keys.length > 0) await this.client.del(keys);
  }
}

function createOpts(max) {
  return {
    windowMs: 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      error: { message: 'Too many requests. Try again in a moment.', type: 'rate_limit_error', code: 'rate_limited' }
    },
  };
}

function createStore(prefix) {
  const s = new RedisStore();
  s.prefix = prefix;
  s.init({ windowMs: 60 * 1000 }).catch(() => {});
  return s;
}

export const apiLimiter = rateLimit({ ...createOpts(120), store: createStore('rl:api:') });
export const controlPlaneLimiter = rateLimit({
  ...createOpts(30),
  store: createStore('rl:ctrl:'),
  message: {
    error: { message: 'Too many requests. Try again in a moment.', type: 'rate_limit_error', code: 'rate_limited' }
  },
});

// Per-swarm-key rate limiter: keys on the swarm API key from Authorization header
export const swarmKeyLimiter = rateLimit({
  ...createOpts(SWARM_KEY_RATE_LIMIT),
  store: createStore('rl:swarm:'),
  keyGenerator: (req) => {
    const auth = req.headers['authorization'];
    if (auth && auth.startsWith('Bearer ')) {
      return auth.substring(7);
    }
    return 'unknown';
  },
});
