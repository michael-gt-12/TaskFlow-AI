import crypto from 'crypto';

/**
 * Identifier and token helpers. UUIDs are used for primary keys (delegated to
 * the database default) while these helpers cover opaque tokens for sessions,
 * invitations, password resets, API keys and webhook secrets.
 */

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function randomUrlSafeToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}

/**
 * Generate an API key with a public prefix and a secret portion. Only the
 * hashed secret is persisted; the full key is shown to the user exactly once.
 */
export function generateApiKey(): { prefix: string; secret: string; full: string } {
  const prefix = `tfa_${crypto.randomBytes(4).toString('hex')}`;
  const secret = crypto.randomBytes(24).toString('base64url');
  return { prefix, secret, full: `${prefix}.${secret}` };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function constantTimeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Compute an HMAC signature for webhook payloads so receivers can verify
 * authenticity.
 */
export function signPayload(payload: string, secret: string): string {
  return crypto.createHmac('sha256', secret).update(payload).digest('hex');
}

export function shortId(length = 8): string {
  return crypto.randomBytes(Math.ceil(length / 2)).toString('hex').slice(0, length);
}

/**
 * Deterministic numeric hash for a string, used for percentage-based feature
 * flag rollouts so the same organization consistently lands in or out of a
 * rollout bucket.
 */
export function stableHashPercent(input: string): number {
  const hash = crypto.createHash('md5').update(input).digest();
  return hash.readUInt32BE(0) % 100;
}
