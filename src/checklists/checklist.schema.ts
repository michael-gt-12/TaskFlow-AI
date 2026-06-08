import { z } from 'zod';
import { uuidSchema } from '../shared/validation';

export const CreateChecklistSchema = z.object({
  body: z.object({
    taskId: uuidSchema,
    title: z.string().min(1, 'Title is required').max(200),
  }),
});

export const UpdateChecklistSchema = z.object({
  body: z.object({
    title: z.string().min(1).max(200),
  }),
});

export const AddChecklistItemSchema = z.object({
  body: z.object({
    content: z.string().min(1, 'Content is required').max(500),
  }),
});

export const UpdateChecklistItemSchema = z.object({
  body: z.object({
    content: z.string().min(1).max(500).optional(),
    isComplete: z.boolean().optional(),
  }),
});
