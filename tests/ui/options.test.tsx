import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from '../../src/options/App';
import * as store from '../../src/lib/storage/local-store';
import { emptyAiSettings } from '../../src/lib/schema/settings';
import { emptyProfile } from '../../src/lib/schema/profile';

describe('options app', () => {
  it('loads and saves DeepSeek settings alongside the master profile', async () => {
    const loadMasterProfile = vi.spyOn(store, 'loadMasterProfile').mockResolvedValue(emptyProfile());
    const loadAiSettings = vi.spyOn(store, 'loadAiSettings').mockResolvedValue(emptyAiSettings());
    vi.spyOn(store, 'loadRememberedResume').mockResolvedValue(null);
    const saveAiSettings = vi.spyOn(store, 'saveAiSettings').mockResolvedValue();
    const saveMasterProfile = vi.spyOn(store, 'saveMasterProfile').mockResolvedValue();

    render(<App />);

    await waitFor(() => expect(loadMasterProfile).toHaveBeenCalledOnce());
    await waitFor(() => expect(loadAiSettings).toHaveBeenCalledOnce());

    fireEvent.change(screen.getByLabelText('DeepSeek API Key'), {
      target: { value: 'ds-test-key' }
    });
    fireEvent.click(screen.getByRole('button', { name: 'Save profile' }));

    await waitFor(() => expect(saveMasterProfile).toHaveBeenCalledOnce());
    await waitFor(() =>
      expect(saveAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: 'deepseek',
          apiKey: 'ds-test-key'
        })
      )
    );
  });

  it('shows saved resume metadata and allows replacement', async () => {
    vi.spyOn(store, 'loadMasterProfile').mockResolvedValue(emptyProfile());
    vi.spyOn(store, 'loadAiSettings').mockResolvedValue(emptyAiSettings());
    vi.spyOn(store, 'loadRememberedResume').mockResolvedValue({
      fileName: 'ella_resume.pdf',
      updatedAt: '2026-05-16T10:00:00.000Z'
    });

    render(<App />);

    await waitFor(() => expect(screen.getByText('ella_resume.pdf')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Replace resume' })).toBeTruthy();
  });
});
