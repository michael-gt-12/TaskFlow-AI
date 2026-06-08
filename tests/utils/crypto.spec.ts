import { describe, it, expect } from 'vitest';
import { CryptoUtils } from '../../src/utils/crypto';

describe('CryptoUtils', () => {
  describe('Password Hashing', () => {
    it('should hash password and successfully compare it', async () => {
      const password = 'mySecurePassword123';
      const hash = await CryptoUtils.hashPassword(password);
      
      expect(hash).toBeDefined();
      expect(hash).not.toBe(password);
      
      const isMatch = await CryptoUtils.comparePassword(password, hash);
      expect(isMatch).toBe(true);
      
      const isNotMatch = await CryptoUtils.comparePassword('wrongPassword', hash);
      expect(isNotMatch).toBe(false);
    });
  });

  describe('JWT Management', () => {
    const payload = {
      id: 'user-123',
      email: 'user@test.com',
      role: 'USER' as any,
    };

    it('should generate and verify access tokens', () => {
      const token = CryptoUtils.generateAccessToken(payload);
      expect(token).toBeDefined();

      const decoded = CryptoUtils.verifyToken(token);
      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
    });

    it('should generate and verify refresh tokens', () => {
      const token = CryptoUtils.generateRefreshToken(payload);
      expect(token).toBeDefined();

      const decoded = CryptoUtils.verifyToken(token);
      expect(decoded.id).toBe(payload.id);
      expect(decoded.email).toBe(payload.email);
    });

    it('should throw UnauthorizedError when token is invalid or expired', () => {
      expect(() => CryptoUtils.verifyToken('invalid-token')).toThrow(/invalid or expired/i);
    });
  });
});
