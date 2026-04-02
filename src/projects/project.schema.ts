import { z } from 'zod';

export const CreateProjectSchema = z.object({
  body: z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    description: z.string().optional(),
    orgId: z.string({ required_error: 'Organization ID is required' })
  })
});
