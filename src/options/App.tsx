import { useEffect, useRef, useState } from 'react';
import {
  rememberedResumeFromFile,
  type RememberedResume
} from '../lib/import/pdf-session-store';
import { importPdfResumeSafely } from '../lib/import/pdf-importer';
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
  const [loadWarning, setLoadWarning] = useState('');
  const [statusMessage, setStatusMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [savedProfileRecently, setSavedProfileRecently] = useState(false);
  const resumeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    Promise.allSettled([loadMasterProfile(), loadAiSettings(), loadRememberedResume()]).then((results) => {
      const [profileResult, settingsResult, resumeResult] = results;

      if (profileResult.status === 'fulfilled') {
        setProfile(profileResult.value);
      }

      if (settingsResult.status === 'fulfilled') {
        setAiSettings(settingsResult.value);
      }

      if (resumeResult.status === 'fulfilled') {
        setRememberedResume(resumeResult.value);
      } else {
        setLoadWarning('Resume cache could not be loaded, but you can still update settings.');
      }

      setReady(true);
    });
  }, []);

  if (!ready) {
    return <p>Loading profile...</p>;
  }

  async function handleSave() {
    setStatusMessage('');
    setErrorMessage('');
    setSavedProfileRecently(false);
    setSavingProfile(true);

    try {
      await Promise.all([saveMasterProfile(profile), saveAiSettings(aiSettings)]);
      const [storedProfile, storedSettings] = await Promise.all([loadMasterProfile(), loadAiSettings()]);

      setProfile(storedProfile);
      setAiSettings(storedSettings);
      setSavedProfileRecently(true);
      setStatusMessage('Settings saved locally.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save settings.';
      setErrorMessage(`Save failed: ${message}`);
    } finally {
      setSavingProfile(false);
    }
  }

  async function handleResumeChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    setStatusMessage('');
    setErrorMessage('');
    setSavedProfileRecently(false);
    setUploadingResume(true);

    try {
      const [nextResume, extractedText] = await Promise.all([rememberedResumeFromFile(file), importPdfResumeSafely(file)]);
      const nextRememberedResume = {
        ...nextResume,
        extractedText
      };

      await saveRememberedResume(nextRememberedResume);
      setRememberedResume(nextRememberedResume);
      setStatusMessage(
        extractedText
          ? 'Resume saved for reuse on future application pages.'
          : 'Resume saved, but readable PDF text was limited.'
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unable to save this PDF.';
      setErrorMessage(`Resume upload failed: ${message}`);
    } finally {
      setUploadingResume(false);
      event.target.value = '';
    }
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
        {loadWarning ? <p className="options-muted">{loadWarning}</p> : null}
      </section>

      <div className="options-grid">
        <section className="options-card">
          <h2>Saved Resume</h2>
          {rememberedResume ? (
            <div className="options-meta">
              <strong>{rememberedResume.fileName}</strong>
              <p className="options-muted">Updated {new Date(rememberedResume.updatedAt).toLocaleString()}</p>
              <button
                type="button"
                className="options-button-secondary"
                onClick={handleReplaceResume}
                disabled={uploadingResume}
              >
                {uploadingResume ? 'Saving resume...' : 'Replace resume'}
              </button>
            </div>
          ) : (
            <>
              <p className="options-muted">No PDF resume saved yet.</p>
              <button
                type="button"
                className="options-button-secondary"
                onClick={handleReplaceResume}
                disabled={uploadingResume}
              >
                {uploadingResume ? 'Saving resume...' : 'Choose resume PDF'}
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
            <button type="button" className="options-button-primary" onClick={handleSave} disabled={savingProfile}>
              {savingProfile ? 'Saving...' : savedProfileRecently ? 'Saved' : 'Save profile'}
            </button>
            {statusMessage ? <p className="options-inline-status">{statusMessage}</p> : null}
            {errorMessage ? <p className="options-inline-error">{errorMessage}</p> : null}
          </div>
        </section>
      </div>
    </main>
  );
}
