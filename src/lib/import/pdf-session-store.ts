import { z } from 'zod';

export const REMEMBERED_RESUME_STORAGE_KEY = 'remembered-resume';

export const rememberedResumeSchema = z.object({
  fileName: z.string().min(1),
  updatedAt: z.string().datetime(),
  bytesBase64: z.string().optional(),
  extractedText: z.string().optional()
});

export type RememberedResume = z.infer<typeof rememberedResumeSchema>;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary);
}

export async function rememberedResumeFromFile(file: File): Promise<RememberedResume> {
  const bytes = new Uint8Array(await file.arrayBuffer());

  return rememberedResumeSchema.parse({
    fileName: file.name,
    updatedAt: new Date().toISOString(),
    bytesBase64: bytesToBase64(bytes)
  });
}
