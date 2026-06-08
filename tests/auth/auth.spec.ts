import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AuthService } from '../../src/auth/auth.service';
import { prisma } from '../../src/database/client';
import { CryptoUtils } from '../../src/utils/crypto';

vi.mock('../../src/database/client', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn()
    }
  }
}));

describe('AuthService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('register', () => {
    it('should create new user and return tokens', async () => {
      const mockUser = {
        id: 'u1',
        email: 'test@example.com',
        name: 'Test Tester',
        passwordHash: 'hashed',
        role: 'USER'
      };

      vi.mocked(prisma.user.findUnique).mockResolvedValue(null);
      vi.mocked(prisma.user.create).mockResolvedValue(mockUser as any);

      const result = await AuthService.register({
        email: 'test@example.com',
        password: 'password123',
        name: 'Test Tester'
      });

      expect(result.user.email).toBe('test@example.com');
      expect(result.accessToken).toBeDefined();
      expect(result.refreshToken).toBeDefined();
    });
  });
});
