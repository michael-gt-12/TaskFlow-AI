import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../../src/auth/auth.service';
import { prisma } from '../../src/database/client';
import { CryptoUtils } from '../../src/utils/crypto';

vi.mock('../../src/database/client', () => ({
  prisma: { user: { findUnique: vi.fn(), create: vi.fn() } },
}));

vi.mock('../../src/utils/crypto', () => ({
  CryptoUtils: {
    hashPassword: vi.fn().mockResolvedValue('hashed'),
    comparePassword: vi.fn(),
    generateAccessToken: vi.fn().mockReturnValue('access'),
    generateRefreshToken: vi.fn().mockReturnValue('refresh'),
    verifyToken: vi.fn(),
  },
}));

const user = { id: 'u1', email: 'a@b.com', name: 'Al', passwordHash: 'hashed', role: 'USER' };

describe('AuthService (extra)', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('register', () => {
    it('rejects an email that is already in use', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(user);
      await expect(
        AuthService.register({ email: 'a@b.com', password: 'longenough', name: 'Al' })
      ).rejects.toThrow(/already in use/i);
      expect(prisma.user.create).not.toHaveBeenCalled();
    });

    it('hashes the password before persisting', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      (prisma.user.create as any).mockResolvedValue(user);
      await AuthService.register({ email: 'a@b.com', password: 'plaintext', name: 'Al' });
      expect(CryptoUtils.hashPassword).toHaveBeenCalledWith('plaintext');
      expect(prisma.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ passwordHash: 'hashed' }) })
      );
    });
  });

  describe('login', () => {
    it('throws on an unknown email', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(null);
      await expect(AuthService.login({ email: 'x@b.com', password: 'p' })).rejects.toThrow(/invalid credentials/i);
    });

    it('throws when the password does not match', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(user);
      (CryptoUtils.comparePassword as any).mockResolvedValue(false);
      await expect(AuthService.login({ email: 'a@b.com', password: 'wrong' })).rejects.toThrow(/invalid credentials/i);
    });

    it('returns tokens on valid credentials', async () => {
      (prisma.user.findUnique as any).mockResolvedValue(user);
      (CryptoUtils.comparePassword as any).mockResolvedValue(true);
      const result = await AuthService.login({ email: 'a@b.com', password: 'right' });
      expect(result.accessToken).toBe('access');
      expect(result.refreshToken).toBe('refresh');
      expect(result.user.email).toBe('a@b.com');
    });
  });

  describe('refreshToken', () => {
    it('throws when the token maps to a deleted user', async () => {
      (CryptoUtils.verifyToken as any).mockReturnValue({ id: 'u1', email: 'a@b.com', role: 'USER' });
      (prisma.user.findUnique as any).mockResolvedValue(null);
      await expect(AuthService.refreshToken('tok')).rejects.toThrow(/not found or deleted/i);
    });

    it('issues a fresh token pair for a valid token', async () => {
      (CryptoUtils.verifyToken as any).mockReturnValue({ id: 'u1', email: 'a@b.com', role: 'USER' });
      (prisma.user.findUnique as any).mockResolvedValue(user);
      const result = await AuthService.refreshToken('tok');
      expect(result.accessToken).toBe('access');
      expect(result.refreshToken).toBe('refresh');
      expect(CryptoUtils.verifyToken).toHaveBeenCalledWith('tok');
    });
  });
});
