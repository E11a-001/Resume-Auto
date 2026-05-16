import { z } from 'zod';

export const aiSettingsSchema = z.object({
  provider: z.literal('deepseek').default('deepseek'),
  apiKey: z.string().default(''),
  baseUrl: z.string().default('https://api.deepseek.com'),
  model: z.string().default('deepseek-v4-flash')
});

export type AiSettings = z.infer<typeof aiSettingsSchema>;

export function emptyAiSettings(): AiSettings {
  return aiSettingsSchema.parse({});
}
