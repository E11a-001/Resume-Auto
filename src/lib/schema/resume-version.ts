import { z } from 'zod';
import { profileSchema } from './profile';

export const resumeVersionSchema = z.object({
  id: z.string(),
  name: z.string(),
  sourceProfileId: z.string(),
  createdAt: z.string(),
  jobContext: z.object({
    company: z.string(),
    roleTitle: z.string(),
    keywords: z.array(z.string()).default([])
  }),
  profile: profileSchema
});

export type ResumeVersion = z.infer<typeof resumeVersionSchema>;
