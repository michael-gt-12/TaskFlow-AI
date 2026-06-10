import { describe, it, expect } from 'vitest';
import { OrgRole } from '@prisma/client';
import { CreateOrgSchema, InviteMemberSchema } from '../../src/organizations/org.schema';

describe('org.schema', () => {
  describe('CreateOrgSchema', () => {
    it('accepts a valid name + slug', () => {
      const parsed = CreateOrgSchema.parse({ body: { name: 'Acme', slug: 'acme-co' } });
      expect(parsed.body.slug).toBe('acme-co');
    });

    it('rejects a short name', () => {
      const res = CreateOrgSchema.safeParse({ body: { name: 'A', slug: 'acme' } });
      expect(res.success).toBe(false);
    });

    it('rejects a short slug', () => {
      const res = CreateOrgSchema.safeParse({ body: { name: 'Acme', slug: 'a' } });
      expect(res.success).toBe(false);
    });

    it('rejects a slug with illegal characters', () => {
      const res = CreateOrgSchema.safeParse({ body: { name: 'Acme', slug: 'Acme Co!' } });
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.issues.some((i) => /alphanumeric/i.test(i.message))).toBe(true);
      }
    });

    it('accepts slugs with digits and dashes', () => {
      expect(CreateOrgSchema.safeParse({ body: { name: 'Acme', slug: 'team-42' } }).success).toBe(true);
    });
  });

  describe('InviteMemberSchema', () => {
    it('accepts a valid email + role', () => {
      const parsed = InviteMemberSchema.parse({ body: { email: 'a@b.com', role: OrgRole.MEMBER } });
      expect(parsed.body.role).toBe(OrgRole.MEMBER);
    });

    it('rejects an invalid email', () => {
      const res = InviteMemberSchema.safeParse({ body: { email: 'not-an-email', role: OrgRole.MEMBER } });
      expect(res.success).toBe(false);
    });

    it('rejects an unknown role', () => {
      const res = InviteMemberSchema.safeParse({ body: { email: 'a@b.com', role: 'SUPERHERO' } });
      expect(res.success).toBe(false);
    });
  });
});
