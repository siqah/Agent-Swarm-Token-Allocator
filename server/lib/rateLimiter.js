import rateLimit from 'express-rate-limit';
import { createClient } from 'redis';
import { logger } from './logger.js';

const REDIS_URL = process.env.REDIS_URL || null;

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
    this.prefix = 'rl:';
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

const store = new RedisStore();

export const apiLimiter = rateLimit({ ...createOpts(120), store });
export const controlPlaneLimiter = rateLimit({
  ...createOpts(30),
  store,
  message: {
    error: { message: 'Too many requests. Try again in a moment.', type: 'rate_limit_error', code: 'rate_limited' }
  },
});

// Initialize the store asynchronously (graceful if Redis is down)
store.init({ windowMs: 60 * 1000 }).catch(() => {});
