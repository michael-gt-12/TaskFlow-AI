import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  randomToken,
  randomUrlSafeToken,
  generateApiKey,
  hashToken,
  constantTimeEquals,
  signPayload,
  shortId,
  stableHashPercent,
} from '../../src/shared/ids';

describe('ids', () => {
  describe('randomToken', () => {
    it('returns hex of the requested byte length', () => {
      expect(randomToken(16)).toMatch(/^[0-9a-f]{32}$/);
      expect(randomToken()).toHaveLength(64); // 32 bytes default
    });

    it('produces distinct values', () => {
      expect(randomToken()).not.toBe(randomToken());
    });
  });

  describe('randomUrlSafeToken', () => {
    it('produces url-safe base64 without + / =', () => {
      const token = randomUrlSafeToken(24);
      expect(token).not.toMatch(/[+/=]/);
    });
  });

  describe('generateApiKey', () => {
    it('returns a prefixed key whose full value joins prefix and secret', () => {
      const { prefix, secret, full } = generateApiKey();
      expect(prefix).toMatch(/^tfa_[0-9a-f]{8}$/);
      expect(full).toBe(`${prefix}.${secret}`);
      expect(secret.length).toBeGreaterThan(0);
    });
  });

  describe('hashToken', () => {
    it('matches a manual sha256 hex digest and is deterministic', () => {
      const expected = crypto.createHash('sha256').update('secret').digest('hex');
      expect(hashToken('secret')).toBe(expected);
      expect(hashToken('secret')).toBe(hashToken('secret'));
    });
  });

  describe('constantTimeEquals', () => {
    it('returns true for identical strings', () => {
      expect(constantTimeEquals('abcdef', 'abcdef')).toBe(true);
    });

    it('returns false for equal-length but different strings', () => {
      expect(constantTimeEquals('abcdef', 'abcdeg')).toBe(false);
    });

    it('returns false for differing lengths', () => {
      expect(constantTimeEquals('abc', 'abcd')).toBe(false);
    });
  });

  describe('signPayload', () => {
    it('matches a manual HMAC-SHA256 and depends on the secret', () => {
      const expected = crypto.createHmac('sha256', 'key').update('payload').digest('hex');
      expect(signPayload('payload', 'key')).toBe(expected);
      expect(signPayload('payload', 'key')).not.toBe(signPayload('payload', 'other'));
    });
  });

  describe('shortId', () => {
    it('returns a hex string of the requested length', () => {
      expect(shortId(8)).toMatch(/^[0-9a-f]{8}$/);
      expect(shortId(5)).toHaveLength(5);
    });
  });

  describe('stableHashPercent', () => {
    it('returns a value in [0, 100)', () => {
      const v = stableHashPercent('org-123');
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(100);
    });

    it('is deterministic for the same input', () => {
      expect(stableHashPercent('org-123')).toBe(stableHashPercent('org-123'));
    });
  });
});
