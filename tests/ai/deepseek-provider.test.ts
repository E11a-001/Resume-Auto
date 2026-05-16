import { describe, expect, it, vi } from 'vitest';
import { createDeepSeekProvider } from '../../src/lib/ai/cloud-provider';

describe('createDeepSeekProvider', () => {
  it('calls the official DeepSeek chat completions endpoint and returns the first message', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Drafted answer'
            }
          }
        ]
      })
    });

    const provider = createDeepSeekProvider(
      {
        provider: 'deepseek',
        apiKey: 'test-key',
        baseUrl: 'https://api.deepseek.com',
        model: 'deepseek-v4-flash'
      },
      fetchMock as typeof fetch
    );

    await expect(
      provider.complete({
        system: 'System prompt',
        user: 'User prompt'
      })
    ).resolves.toBe('Drafted answer');

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.deepseek.com/chat/completions',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Content-Type': 'application/json',
          Authorization: 'Bearer test-key'
        })
      })
    );
  });
});
