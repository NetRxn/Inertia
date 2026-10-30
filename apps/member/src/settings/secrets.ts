import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

type Env = Record<string, string | undefined>;

const MIN_KEY_LENGTH = 32;

export class SecretKeyMissingError extends Error {
  constructor() {
    super(`Set MEMBER_APP_SECRET_KEY (at least ${MIN_KEY_LENGTH} characters) to store keys in the app.`);
  }
}

function key(env: Env): Buffer {
  const secret = env.MEMBER_APP_SECRET_KEY?.trim();
  if (!secret || secret.length < MIN_KEY_LENGTH) throw new SecretKeyMissingError();
  return createHash('sha256').update(secret).digest();
}

/** AES-256-GCM, as `v1.<iv>.<tag>.<ciphertext>` in base64url. */
export function encryptSecret(plaintext: string, env: Env = process.env): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(env), iv);
  const data = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return ['v1', iv, cipher.getAuthTag(), data].map((part) => (typeof part === 'string' ? part : part.toString('base64url'))).join('.');
}

export function decryptSecret(sealed: string, env: Env = process.env): string {
  const [version, iv, tag, data] = sealed.split('.');
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unreadable secret.');
  const decipher = createDecipheriv('aes-256-gcm', key(env), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
