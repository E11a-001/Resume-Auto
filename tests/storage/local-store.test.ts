import { describe, expect, it, vi } from 'vitest';
import {
  loadRememberedResume,
  loadMasterProfile,
  loadResumeVersions,
  saveRememberedResume,
  saveMasterProfile,
  saveResumeVersion
} from '../../src/lib/storage/local-store';
import { emptyProfile } from '../../src/lib/schema/profile';

describe('local-store', () => {
  it('round-trips the master profile through chrome.storage.local', async () => {
    const data = new Map<string, unknown>();
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (key: string) => ({ [key]: data.get(key) }),
          set: async (value: Record<string, unknown>) => {
            Object.entries(value).forEach(([entryKey, entryValue]) => data.set(entryKey, entryValue));
          }
        }
      }
    });

    const profile = { ...emptyProfile(), fullName: 'Ella Example' };
    await saveMasterProfile(profile);
    await expect(loadMasterProfile()).resolves.toMatchObject({ fullName: 'Ella Example' });
  });

  it('stores tailored resume versions separately from the master profile', async () => {
    const data = new Map<string, unknown>();
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (key: string) => ({ [key]: data.get(key) }),
          set: async (value: Record<string, unknown>) => {
            Object.entries(value).forEach(([entryKey, entryValue]) => data.set(entryKey, entryValue));
          }
        }
      }
    });

    await saveResumeVersion({
      id: 'version-1',
      name: 'Example Corp - ML Engineer - v1',
      sourceProfileId: 'master-profile',
      createdAt: '2026-05-15T00:00:00.000Z',
      jobContext: {
        company: 'Example Corp',
        roleTitle: 'ML Engineer',
        keywords: ['python']
      },
      profile: emptyProfile()
    });

    await expect(loadResumeVersions()).resolves.toHaveLength(1);
    await expect(loadMasterProfile()).resolves.toMatchObject({ fullName: '' });
  });

  it('round-trips remembered resume metadata separately from profile data', async () => {
    const data = new Map<string, unknown>();
    vi.stubGlobal('chrome', {
      storage: {
        local: {
          get: async (key: string) => ({ [key]: data.get(key) }),
          set: async (value: Record<string, unknown>) => {
            Object.entries(value).forEach(([entryKey, entryValue]) => data.set(entryKey, entryValue));
          }
        }
      }
    });

    await saveRememberedResume({
      fileName: 'ella_resume.pdf',
      updatedAt: '2026-05-16T10:00:00.000Z',
      extractedText: 'Ella Example'
    });

    await expect(loadRememberedResume()).resolves.toMatchObject({
      fileName: 'ella_resume.pdf',
      extractedText: 'Ella Example'
    });
    await expect(loadMasterProfile()).resolves.toMatchObject({ fullName: '' });
  });
});
