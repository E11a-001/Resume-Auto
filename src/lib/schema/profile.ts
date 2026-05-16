import { z } from 'zod';

export const experienceSchema = z.object({
  id: z.string(),
  type: z.enum(['full_time', 'internship', 'part_time', 'contract', 'freelance', 'project']),
  company: z.string(),
  title: z.string(),
  location: z.string().default(''),
  startDate: z.string().default(''),
  endDate: z.string().default(''),
  isCurrent: z.boolean().default(false),
  description: z.array(z.string()).default([])
});

export const profileSchema = z.object({
  fullName: z.string().default(''),
  email: z.string().default(''),
  phone: z.string().default(''),
  location: z.string().default(''),
  citizenship: z.string().default(''),
  workAuthorization: z.string().default(''),
  links: z.array(z.object({ label: z.string(), url: z.string() })).default([]),
  experiences: z.array(experienceSchema).default([]),
  education: z.array(z.object({ id: z.string(), school: z.string(), degree: z.string() })).default([]),
  projects: z.array(z.object({ id: z.string(), name: z.string(), description: z.array(z.string()).default([]) })).default([]),
  skills: z.array(z.string()).default([]),
  certifications: z.array(z.string()).default([]),
  languages: z.array(z.string()).default([])
});

export type Profile = z.infer<typeof profileSchema>;

export const emptyProfile = (): Profile => profileSchema.parse({});
