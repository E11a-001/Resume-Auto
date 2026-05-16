import { describe, expect, it, vi } from 'vitest';
import { draftAnswer } from '../../src/lib/answers/draft-answer';

describe('draftAnswer', () => {
  it('requests a JD-aware answer draft only when explicitly invoked', async () => {
    const provider = {
      complete: vi.fn().mockResolvedValue('I want this role because...')
    };

    const output = await draftAnswer(provider, {
      question: 'Why do you want this role?',
      profileSummary: 'Applied AI and evaluation experience',
      jobSummary: 'ML evaluation and tooling'
    });

    expect(provider.complete).toHaveBeenCalledOnce();
    expect(output).toContain('I want this role');
  });
});
