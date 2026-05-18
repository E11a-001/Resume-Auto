import {
  rememberedResumeSchema,
  type RememberedResume
} from '../import/pdf-session-store';
import { extractPdfTextFromBytes } from '../import/pdf-importer';
import { emptyProfile, profileSchema, type Profile } from '../schema/profile';
import { resumeVersionSchema, type ResumeVersion } from '../schema/resume-version';
import { aiSettingsSchema, emptyAiSettings, type AiSettings } from '../schema/settings';
import { STORAGE_KEYS } from './keys';

function base64ToBytes(base64: string) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function looksBrokenResumeText(text: string | undefined) {
  if (!text) {
    return true;
  }

  const normalized = text.toLowerCase();
  const markers = ['/author', '/producer', '/creationdate', '/creator', '/moddate', 'endobj', 'xref'];

  return markers.filter((marker) => normalized.includes(marker)).length >= 2;
}

async function hydrateResumeText(resume: RememberedResume) {
  if (!resume.bytesBase64 || !looksBrokenResumeText(resume.extractedText)) {
    return resume;
  }

  return rememberedResumeSchema.parse({
    ...resume,
    extractedText: await extractPdfTextFromBytes(base64ToBytes(resume.bytesBase64))
  });
}

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

  if (!storedResume) {
    return null;
  }

  const parsedResume = rememberedResumeSchema.parse(storedResume);
  const hydratedResume = await hydrateResumeText(parsedResume);

  if (hydratedResume.extractedText !== parsedResume.extractedText) {
    await saveRememberedResume(hydratedResume);
  }

  return hydratedResume;
}

export async function saveRememberedResume(resume: RememberedResume): Promise<void> {
  const parsedResume = rememberedResumeSchema.parse(resume);

  try {
    await chrome.storage.local.set({
      [STORAGE_KEYS.rememberedResume]: parsedResume
    });
  } catch (error) {
    if (!parsedResume.bytesBase64) {
      throw error;
    }

    await chrome.storage.local.set({
      [STORAGE_KEYS.rememberedResume]: rememberedResumeSchema.parse({
        ...parsedResume,
        bytesBase64: undefined
      })
    });
  }
}
