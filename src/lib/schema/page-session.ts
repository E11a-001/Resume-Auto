import { z } from 'zod';

export const pageSessionSchema = z.object({
  isApplicationPage: z.boolean(),
  confidence: z.enum(['high', 'medium', 'low']),
  domain: z.string(),
  recognizedFieldCount: z.number().int().nonnegative(),
  status: z.enum(['not-ready', 'ready-to-fill', 'filled'])
});

export type PageSession = z.infer<typeof pageSessionSchema>;

export function emptyPageSession(): PageSession {
  return pageSessionSchema.parse({
    isApplicationPage: false,
    confidence: 'low',
    domain: '',
    recognizedFieldCount: 0,
    status: 'not-ready'
  });
}
