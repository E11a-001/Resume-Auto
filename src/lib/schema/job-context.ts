import { z } from 'zod';

export const jobContextSchema = z.object({
  company: z.string(),
  roleTitle: z.string(),
  keywords: z.array(z.string()).default([])
});

export type JobContext = z.infer<typeof jobContextSchema>;
