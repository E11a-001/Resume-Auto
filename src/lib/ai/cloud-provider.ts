import type { AiSettings } from '../schema/settings';
import type { AiProvider, CompletionRequest } from './provider';

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export function createDeepSeekProvider(
  settings: AiSettings,
  fetchImpl: typeof fetch = fetch
): AiProvider {
  return {
    async complete(request: CompletionRequest): Promise<string> {
      if (!settings.apiKey) {
        throw new Error('DeepSeek API key is missing.');
      }

      const response = await fetchImpl(`${settings.baseUrl.replace(/\/$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${settings.apiKey}`
        },
        body: JSON.stringify({
          model: settings.model,
          messages: [
            { role: 'system', content: request.system },
            { role: 'user', content: request.user }
          ],
          thinking: {
            type: 'disabled'
          }
        })
      });

      const payload = (await response.json()) as DeepSeekResponse;

      if (!response.ok) {
        throw new Error(payload.error?.message ?? 'DeepSeek request failed.');
      }

      const content = payload.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error('DeepSeek returned an empty response.');
      }

      return content;
    }
  };
}
