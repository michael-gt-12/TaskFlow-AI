import { z } from 'zod';
import { DependencyType } from '@prisma/client';
import { uuidSchema } from '../shared/validation';

export const CreateDependencySchema = z.object({
  body: z.object({
    sourceTaskId: uuidSchema,
    targetTaskId: uuidSchema,
    type: z.nativeEnum(DependencyType).optional(),
  }),
});
