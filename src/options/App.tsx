import { useEffect, useRef, useState } from 'react';
import {
  rememberedResumeFromFile,
  type RememberedResume
} from '../lib/import/pdf-session-store';
import { importPdfResume } from '../lib/import/pdf-importer';
import { emptyProfile, type Profile } from '../lib/schema/profile';
import { emptyAiSettings, type AiSettings } from '../lib/schema/settings';
import {
  loadAiSettings,
  loadMasterProfile,
  loadRememberedResume,
  saveAiSettings,
  saveMasterProfile,
  saveRememberedResume
} from '../lib/storage/local-store';

export function App() {
  const [profile, setProfile] = useState<Profile>(emptyProfile());
  const [aiSettings, setAiSettings] = useState<AiSettings>(emptyAiSettings());
  const [rememberedResume, setRememberedResume] = useState<RememberedResume | null>(null);
  const [ready, setReady] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.all([loadMasterProfile(), loadAiSettings(), loadRememberedResume()]).then(
      ([storedProfile, storedSettings, storedResume]) => {
        setProfile(storedProfile);
        setAiSettings(storedSettings);
        setRememberedResume(storedResume);
        setReady(true);
      }
    );
  }, []);

  if (!ready) {
    return <p>Loading profile...</p>;
  }

  async function handleSave() {
    await Promise.all([saveMasterProfile(profile), saveAiSettings(aiSettings)]);
  }

  async function handleResumeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    const [nextResume, extractedText] = await Promise.all([rememberedResumeFromFile(file), importPdfResume(file)]);
    const nextRememberedResume = {
      ...nextResume,
      extractedText
    };
    await saveRememberedResume(nextRememberedResume);
    setRememberedResume(nextRememberedResume);
    event.target.value = '';
  }

  function handleReplaceResume() {
    resumeInputRef.current?.click();
  }

  return (
    <main className="options-shell">
      <section className="options-hero">
        <p className="options-eyebrow">Workspace</p>
        <h1 className="options-title">Configure your saved resume and DeepSeek settings.</h1>
        <p className="options-copy">
          The side panel stays focused on the current application page. This screen keeps the remembered resume
          metadata and AI connection details out of the main filling flow.
        </p>
      </section>

      <div className="options-grid">
        <section className="options-card">
          <h2>Saved Resume</h2>
          {rememberedResume ? (
            <div className="options-meta">
              <strong>{rememberedResume.fileName}</strong>
              <p className="options-muted">Updated {new Date(rememberedResume.updatedAt).toLocaleString()}</p>
              <button type="button" className="options-button-secondary" onClick={handleReplaceResume}>
                Replace resume
              </button>
            </div>
          ) : (
            <>
              <p className="options-muted">No PDF resume saved yet.</p>
              <button type="button" className="options-button-secondary" onClick={handleReplaceResume}>
                Choose resume PDF
              </button>
            </>
          )}
          <input
            ref={resumeInputRef}
            id="resumeUpload"
            type="file"
            accept=".pdf,application/pdf"
            onChange={handleResumeChange}
            hidden
          />
        </section>

        <section className="options-card">
          <h2>Master Profile</h2>
          <div className="options-field">
            <label htmlFor="fullName">Full Name</label>
            <input
              id="fullName"
              value={profile.fullName}
              onChange={(event) => setProfile({ ...profile, fullName: event.target.value })}
            />
          </div>
        </section>

        <section className="options-card">
          <h2>DeepSeek</h2>
          <p className="options-muted">Used for JD-aware answer drafting and later resume tailoring.</p>
          <div className="options-field">
            <label htmlFor="deepseekApiKey">DeepSeek API Key</label>
            <input
              id="deepseekApiKey"
              aria-label="DeepSeek API Key"
              type="password"
              value={aiSettings.apiKey}
              onChange={(event) => setAiSettings({ ...aiSettings, apiKey: event.target.value })}
            />
          </div>
          <div className="options-field">
            <label htmlFor="deepseekModel">DeepSeek Model</label>
            <input
              id="deepseekModel"
              aria-label="DeepSeek Model"
              value={aiSettings.model}
              onChange={(event) => setAiSettings({ ...aiSettings, model: event.target.value })}
            />
          </div>
          <div className="options-field">
            <label htmlFor="deepseekBaseUrl">DeepSeek Base URL</label>
            <input
              id="deepseekBaseUrl"
              aria-label="DeepSeek Base URL"
              value={aiSettings.baseUrl}
              onChange={(event) => setAiSettings({ ...aiSettings, baseUrl: event.target.value })}
            />
          </div>

          <div className="options-actions">
            <button type="button" className="options-button-primary" onClick={handleSave}>
              Save profile
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
