import { describe, it, expect } from 'vitest';
import { RegisterSchema, LoginSchema, RefreshTokenSchema } from '../../src/auth/auth.schema';

describe('auth.schema', () => {
  describe('RegisterSchema', () => {
    it('accepts a valid registration body', () => {
      const parsed = RegisterSchema.parse({
        body: { email: 'a@b.com', password: 'longenough', name: 'Alice' },
      });
      expect(parsed.body.email).toBe('a@b.com');
    });

    it('rejects an invalid email', () => {
      expect(RegisterSchema.safeParse({ body: { email: 'nope', password: 'longenough', name: 'Al' } }).success).toBe(false);
    });

    it('rejects a short password', () => {
      expect(RegisterSchema.safeParse({ body: { email: 'a@b.com', password: 'short', name: 'Al' } }).success).toBe(false);
    });

    it('rejects a short name', () => {
      expect(RegisterSchema.safeParse({ body: { email: 'a@b.com', password: 'longenough', name: 'A' } }).success).toBe(false);
    });
  });

  describe('LoginSchema', () => {
    it('accepts a valid login body', () => {
      expect(LoginSchema.safeParse({ body: { email: 'a@b.com', password: 'x' } }).success).toBe(true);
    });

    it('rejects an invalid email', () => {
      expect(LoginSchema.safeParse({ body: { email: 'bad', password: 'x' } }).success).toBe(false);
    });

    it('requires a password field', () => {
      expect(LoginSchema.safeParse({ body: { email: 'a@b.com' } }).success).toBe(false);
    });
  });

  describe('RefreshTokenSchema', () => {
    it('accepts a refresh token', () => {
      expect(RefreshTokenSchema.safeParse({ body: { refreshToken: 'tok' } }).success).toBe(true);
    });

    it('rejects a missing refresh token', () => {
      expect(RefreshTokenSchema.safeParse({ body: {} }).success).toBe(false);
    });
  });
});
