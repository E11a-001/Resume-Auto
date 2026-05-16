import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from '../../src/sidepanel/App';
import * as store from '../../src/lib/storage/local-store';
import { emptyAiSettings } from '../../src/lib/schema/settings';

beforeEach(() => {
  vi.restoreAllMocks();
  vi.spyOn(store, 'loadAiSettings').mockResolvedValue(emptyAiSettings());
  vi.spyOn(store, 'loadRememberedResume').mockResolvedValue({
    fileName: 'ella_resume.pdf',
    updatedAt: '2026-05-16T10:00:00.000Z',
    extractedText: 'Ella Example ella@example.com Product analyst'
  });
  vi.stubGlobal('chrome', {
    tabs: {
      query: vi.fn().mockResolvedValue([]),
      sendMessage: vi.fn()
    }
  });
});

afterEach(() => {
  cleanup();
});

describe('sidepanel workflow', () => {
  it('renders the four-step application workflow with the saved resume metadata', async () => {
    render(<App />);

    await waitFor(() => expect(screen.getByText('Drop your original resume PDF.')).toBeTruthy());
    expect(screen.getByText('Paste the job description.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Smart Fill' })).toBeTruthy();
    expect(screen.getByText('ella_resume.pdf')).toBeTruthy();
  });

  it('generates a draft answer with saved DeepSeek settings when open questions are present', async () => {
    vi.spyOn(store, 'loadAiSettings').mockResolvedValue({
      ...emptyAiSettings(),
      apiKey: 'ds-test-key'
    });
    vi.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: 'Generated with DeepSeek'
            }
          }
        ]
      })
    } as Response);

    render(<App initialQuestions={['Why do you want this role?']} />);

    fireEvent.change(screen.getByLabelText('Question Job Summary'), {
      target: { value: 'ML evaluation systems' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Generate Answer' }));

    await waitFor(() => expect(screen.getByText('Generated with DeepSeek')).toBeTruthy());
  });
});
