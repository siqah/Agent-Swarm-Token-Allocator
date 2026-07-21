import crypto from 'crypto';
import { logger } from './logger.js';

const ALGORITHM = 'aes-256-gcm';
const _KEY_LENGTH = 32;
const IV_LENGTH = 16;

function deriveKey(secret) {
  return crypto.scryptSync(secret, 'swarm-encryption-salt', 32);
}

let encryptionKey = null;
if (process.env[KEY_ENV]) {
  encryptionKey = deriveKey(process.env[KEY_ENV]);
} else {
  logger.warn(`${KEY_ENV} not set — provider keys stored in plaintext. Set ${KEY_ENV} for encryption at rest.`);
}

export function encrypt(plaintext) {
  if (!encryptionKey) return plaintext;
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, encryptionKey, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const tag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${tag}:${encrypted}`;
}

export function decrypt(ciphertext) {
  if (!encryptionKey) return ciphertext;
  if (!ciphertext || !ciphertext.includes(':')) return ciphertext;
  const parts = ciphertext.split(':');
  if (parts.length < 3) return ciphertext;
  const iv = Buffer.from(parts[0], 'hex');
  const tag = Buffer.from(parts[1], 'hex');
  const encrypted = parts.slice(2).join(':');
  const decipher = crypto.createDecipheriv(ALGORITHM, encryptionKey, iv);
  decipher.setAuthTag(tag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function isEncrypted(value) {
  return typeof value === 'string' && value.includes(':') && value.length > 40;
}
