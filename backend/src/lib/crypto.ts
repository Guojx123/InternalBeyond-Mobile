import crypto from 'crypto';
import { env } from '../config/env';

// 用 AES-256-GCM 加密敏感字段（AI Key 等）。密钥取自 ENCRYPTION_KEY（32 字节十六进制）。
const ALGO = 'aes-256-gcm';
const KEY = Buffer.from(env.encryptionKey.padEnd(64, '0').slice(0, 64), 'hex');

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // 格式: iv.tag.ciphertext  (base64)
  return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function decrypt(payload: string): string {
  const [ivB64, tagB64, dataB64] = payload.split('.');
  const iv = Buffer.from(ivB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');
  const data = Buffer.from(dataB64, 'base64');
  const decipher = crypto.createDecipheriv(ALGO, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}
