import { z } from 'zod';
import { uuidSchema, isoDateStringSchema } from '../shared/validation';

// A single time entry records work in whole minutes. We cap an individual entry
// at 24h so an obvious fat-finger (e.g. minutes vs seconds) is rejected rather
// than silently skewing task and user roll-ups.
const minutesSchema = z
  .number()
  .int('Minutes must be a whole number')
  .min(1, 'Minutes must be at least 1')
  .max(24 * 60, 'A single entry cannot exceed 24 hours');

export const LogTimeSchema = z.object({
  body: z.object({
    taskId: uuidSchema,
    minutes: minutesSchema,
    description: z.string().max(500).optional(),
    startedAt: isoDateStringSchema.optional(),
  }),
});

export const UpdateTimeEntrySchema = z.object({
  body: z.object({
    minutes: minutesSchema.optional(),
    description: z.string().max(500).nullable().optional(),
    startedAt: isoDateStringSchema.nullable().optional(),
  }),
});

export const ListTimeEntriesSchema = z.object({
  query: z.object({
    userId: uuidSchema.optional(),
    page: z.coerce.number().int().min(1).optional(),
    pageSize: z.coerce.number().int().min(1).max(100).optional(),
  }),
});
