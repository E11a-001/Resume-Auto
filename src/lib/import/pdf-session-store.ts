import { z } from 'zod';

export const REMEMBERED_RESUME_STORAGE_KEY = 'remembered-resume';

export const rememberedResumeSchema = z.object({
  fileName: z.string().min(1),
  updatedAt: z.string().datetime(),
  bytesBase64: z.string().optional(),
  extractedText: z.string().optional()
});

export type RememberedResume = z.infer<typeof rememberedResumeSchema>;

export async function rememberedResumeFromFile(file: File): Promise<RememberedResume> {
  return rememberedResumeSchema.parse({
    fileName: file.name,
    updatedAt: new Date().toISOString()
  });
}
