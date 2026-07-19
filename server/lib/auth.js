import crypto from 'crypto';
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

export function createSession(userId) {
  const token = crypto.randomUUID();
  sessions.set(token, { userId, expiresAt: Date.now() + SESSION_TTL_MS });
  return token;
}

export function getSession(token) {
  const session = sessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    sessions.delete(token);
    return null;
  }
  return session;
}

export function destroySession(token) {
  sessions.delete(token);
}

export function requireUserAuth(req, res, next) {
  const auth = req.headers['authorization'];
  const token = auth && auth.startsWith('Bearer ') ? auth.substring(7) : null;
  if (!token) {
    return res.status(401).json({
      error: { message: 'Authentication required. Provide a session token.', type: 'authentication_error', code: 'unauthorized' }
    });
  }
  const session = getSession(token);
  if (!session) {
    return res.status(401).json({
      error: { message: 'Invalid or expired session token.', type: 'authentication_error', code: 'unauthorized' }
    });
  }
  req.userId = session.userId;
  next();
}

// Periodic session cleanup
setInterval(() => {
  const now = Date.now();
  for (const [token, session] of sessions) {
    if (now > session.expiresAt) sessions.delete(token);
  }
}, 60_000).unref();
