import { z } from 'zod';
import { OrgRole } from '@prisma/client';

export const CreateOrgSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    slug: z.string().min(2, 'Slug must be at least 2 characters').regex(/^[a-z0-9-]+$/, 'Slug can only contain alphanumeric and dash')
  })
});

export const InviteMemberSchema = z.object({
  body: z.object({
    email: z.string().email('Invalid email address'),
    role: z.nativeEnum(OrgRole)
  })
});
