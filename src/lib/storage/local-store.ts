import {
  rememberedResumeSchema,
  type RememberedResume
} from '../import/pdf-session-store';
import { emptyProfile, profileSchema, type Profile } from '../schema/profile';
import { resumeVersionSchema, type ResumeVersion } from '../schema/resume-version';
import { aiSettingsSchema, emptyAiSettings, type AiSettings } from '../schema/settings';
import { STORAGE_KEYS } from './keys';

export async function loadMasterProfile(): Promise<Profile> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.masterProfile);
  const storedProfile = result[STORAGE_KEYS.masterProfile];

  return storedProfile ? profileSchema.parse(storedProfile) : emptyProfile();
}

export async function saveMasterProfile(profile: Profile): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.masterProfile]: profileSchema.parse(profile)
  });
}

export async function loadResumeVersions(): Promise<ResumeVersion[]> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.resumeVersions);
  const storedVersions = result[STORAGE_KEYS.resumeVersions];

  if (!storedVersions) {
    return [];
  }

  return resumeVersionSchema.array().parse(storedVersions);
}

export async function saveResumeVersion(version: ResumeVersion): Promise<void> {
  const versions = await loadResumeVersions();
  const nextVersions = [...versions, resumeVersionSchema.parse(version)];

  await chrome.storage.local.set({
    [STORAGE_KEYS.resumeVersions]: nextVersions
  });
}

export async function loadAiSettings(): Promise<AiSettings> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.settings);
  const storedSettings = result[STORAGE_KEYS.settings];

  return storedSettings ? aiSettingsSchema.parse(storedSettings) : emptyAiSettings();
}

export async function saveAiSettings(settings: AiSettings): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.settings]: aiSettingsSchema.parse(settings)
  });
}

export async function loadRememberedResume(): Promise<RememberedResume | null> {
  const result = await chrome.storage.local.get(STORAGE_KEYS.rememberedResume);
  const storedResume = result[STORAGE_KEYS.rememberedResume];

  return storedResume ? rememberedResumeSchema.parse(storedResume) : null;
}

export async function saveRememberedResume(resume: RememberedResume): Promise<void> {
  await chrome.storage.local.set({
    [STORAGE_KEYS.rememberedResume]: rememberedResumeSchema.parse(resume)
  });
}
