import crypto from 'crypto';
import { dbCompat as db } from '../db/queries.js';
import { logger } from './logger.js';

const SALT_LENGTH = 16;
const KEY_LENGTH = 64;
const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };
const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

const sessions = new Map();

export function hashPassword(password) {
  return new Promise((resolve, reject) => {
    const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
    crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS, (err, key) => {
      if (err) return reject(err);
      resolve(`${salt}:${key.toString('hex')}`);
    });
  });
}

export function verifyPassword(password, stored) {
  return new Promise((resolve, reject) => {
    const [salt, keyHex] = stored.split(':');
    crypto.scrypt(password, salt, KEY_LENGTH, SCRYPT_PARAMS, (err, key) => {
      if (err) return reject(err);
      resolve(crypto.timingSafeEqual(Buffer.from(keyHex, 'hex'), key));
    });
  });
}

export async function createSession(userId) {
  const token = crypto.randomUUID();

  // Always store in memory
  sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });

  // Also persist to PostgreSQL if available
  if (db.isPostgres && db.pool) {
    try {
      await db.pool.query(
        'INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING',
        [token, userId, Date.now() + SESSION_TTL_MS]
      );
    } catch (err) {
      logger.warn('Failed to persist session to PostgreSQL:', err.message);
    }
  }

  return token;
}

export async function getSession(token) {
  // Check in-memory first
  const mem = sessions.get(token);
  if (mem) {
    if (Date.now() > mem.expiresAt) {
      sessions.delete(token);
      return null;
    }
    return { userId: mem.userId };
  }

  // Fall back to PostgreSQL
  if (db.isPostgres && db.pool) {
    try {
      const res = await db.pool.query(
        'SELECT user_id, expires_at FROM sessions WHERE token = $1 AND expires_at > $2',
        [token, Date.now()]
      );
      if (res.rows.length > 0) {
        // Cache in memory
        sessions.set(token, { userId: res.rows[0].user_id, expiresAt: Number(res.rows[0].expires_at) });
        return { userId: res.rows[0].user_id };
      }
    } catch (err) {
      logger.warn('Failed to read session from PostgreSQL:', err.message);
    }
  }

  return null;
}

export async function destroySession(token) {
  sessions.delete(token);
  if (db.isPostgres && db.pool) {
    try {
      await db.pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    } catch (err) {
      logger.warn('Failed to delete session from PostgreSQL:', err.message);
    }
  }
}

export async function requireUserAuth(req, res, next) {
  try {
    const auth = req.headers['authorization'];
    const token = auth && auth.startsWith('Bearer ') ? auth.substring(7) : null;
    if (!token) {
      return res.status(401).json({
        error: { message: 'Authentication required. Provide a session token.', type: 'authentication_error', code: 'unauthorized' }
      });
    }
    const session = await getSession(token);
    if (!session) {
      return res.status(401).json({
        error: { message: 'Invalid or expired session token.', type: 'authentication_error', code: 'unauthorized' }
      });
    }
    req.userId = session.userId;
    next();
  } catch (err) {
    next(err);
  }
}

// ── Password Reset Tokens ──────────────────────
const resetTokens = new Map();
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

export function generateResetToken(userId) {
  const token = crypto.randomUUID();
  resetTokens.set(token, { userId, expiresAt: Date.now() + RESET_TOKEN_TTL_MS });
  return token;
}

export function verifyResetToken(token) {
  const entry = resetTokens.get(token);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    resetTokens.delete(token);
    return null;
  }
  resetTokens.delete(token); // one-time use
  return entry.userId;
}

// Periodic cleanup of expired in-memory sessions
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now > session.expiresAt) sessions.delete(token);
  }
  for (const [token, entry] of resetTokens) {
    if (now > entry.expiresAt) resetTokens.delete(token);
  }
}, 60_000).unref();
