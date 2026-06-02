import * as crypto from 'node:crypto';

/**
 * AES-256-GCM field encryption for sensitive PII (e.g. ID numbers) — supports
 * the CSD "Restricted" data classification. Key from env; rotate per the
 * hardening backlog. This is intentionally simple; production should use a
 * KMS-backed key provider.
 */
const KEY = crypto
  .createHash('sha256')
  .update(process.env.FIELD_KEY ?? 'dev-field-key')
  .digest();

export function encrypt(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString('base64')).join('.');
}

export function decrypt(blob: string): string {
  const [iv, tag, enc] = blob.split('.').map((s) => Buffer.from(s, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString('utf8');
}
