import { useEffect, useMemo, useRef, useState } from 'react';
import { createDeepSeekProvider } from '../lib/ai/cloud-provider';
import { planSmartFill } from '../lib/ai/smart-fill';
import { draftAnswer } from '../lib/answers/draft-answer';
import type { FieldDescriptor } from '../lib/forms/semantic-map';
import { bucketFieldReviews } from '../lib/forms/review-buckets';
import { importPdfResumeSafely } from '../lib/import/pdf-importer';
import { rememberedResumeFromFile, type RememberedResume } from '../lib/import/pdf-session-store';
import { emptyPageSession, type PageSession } from '../lib/schema/page-session';
import { emptyAiSettings, type AiSettings } from '../lib/schema/settings';
import type { FieldReview } from '../lib/state/app-state';
import { loadAiSettings, loadRememberedResume, saveRememberedResume } from '../lib/storage/local-store';
import { theme } from '../lib/ui/theme';

type SidepanelAppProps = {
  initialQuestions?: string[];
};

type ScanResult = {
  pageSession?: PageSession;
  fields?: FieldDescriptor[];
};

type SmartFillResult = {
  pageSession?: PageSession;
  fields?: FieldReview[];
  openQuestions?: string[];
};

function hasChromeTabs() {
  return typeof chrome !== 'undefined' && !!chrome.tabs?.query && !!chrome.tabs.sendMessage;
}

function hasChromeScripting() {
  return typeof chrome !== 'undefined' && !!chrome.scripting?.executeScript;
}

function isMissingReceiverError(error: unknown) {
  if (!(error instanceof Error)) {
    return false;
  }

  return /receiving end does not exist|could not establish connection/i.test(error.message);
}

async function withActiveTab<T>(callback: (tabId: number) => Promise<T>, fallback: T): Promise<T> {
  if (!hasChromeTabs()) {
    return fallback;
  }

  const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
  const activeTab = tabs[0];

  if (!activeTab?.id) {
    return fallback;
  }

  return callback(activeTab.id);
}

async function ensureContentScript(tabId: number) {
  if (!hasChromeScripting()) {
    return false;
  }

  await chrome.scripting.executeScript({
    target: { tabId },
    files: ['content.js']
  });

  return true;
}

async function sendMessageToTab<T>(tabId: number, message: unknown): Promise<T> {
  try {
    return (await chrome.tabs.sendMessage(tabId, message)) as T;
  } catch (error) {
    if (!isMissingReceiverError(error)) {
      throw error;
    }

    const injected = await ensureContentScript(tabId);

    if (!injected) {
      throw error;
    }

    return (await chrome.tabs.sendMessage(tabId, message)) as T;
  }
}

function trimResumePreview(text: string | undefined) {
  if (!text) {
    return '';
  }

  return text.replace(/\s+/g, ' ').trim().slice(0, 220);
}

function looksBrokenResumeText(text: string | undefined) {
  if (!text) {
    return true;
  }

  const normalized = text.toLowerCase();
  const markers = ['/author', '/producer', '/creationdate', '/creator', '/moddate', 'endobj', 'xref'];

  return markers.filter((marker) => normalized.includes(marker)).length >= 2;
}

function smartFillFlashMessage({
  fields,
  usedAi,
  fallbackToLocal,
  resumeText
}: {
  fields: FieldReview[];
  usedAi: boolean;
  fallbackToLocal: boolean;
  resumeText: string | undefined;
}) {
  const filledCount = fields.filter((field) => field.status === 'autofilled').length;
  const reviewCount = fields.filter((field) => field.status === 'needs-confirmation').length;

  if (filledCount + reviewCount === 0) {
    if (looksBrokenResumeText(resumeText)) {
      return 'The saved PDF still looks like raw PDF metadata, so Smart Fill does not have usable resume text yet.';
    }

    return 'This page uses structured application fields, but the current resume text could not map them yet.';
  }

  if (usedAi) {
    return 'Used DeepSeek to tailor page-level fill suggestions before writing to the form.';
  }

  if (fallbackToLocal) {
    return 'DeepSeek planning failed, so Smart Fill fell back to local field rules.';
  }

  return 'Filled confident matches directly into the page.';
}

function scanFlashMessage(fields: FieldDescriptor[]) {
  if (fields.length === 0) {
    return 'No visible fields were detected yet. If this page uses repeated sections like internship or project experience, click Add first to reveal enough rows.';
  }

  return `Detected ${fields.length} visible fields on this page.`;
}

export function App({ initialQuestions = [] }: SidepanelAppProps) {
  const [aiSettings, setAiSettings] = useState<AiSettings>(emptyAiSettings());
  const [pageSession, setPageSession] = useState<PageSession>(emptyPageSession());
  const [rememberedResume, setRememberedResume] = useState<RememberedResume | null>(null);
  const [jobDescription, setJobDescription] = useState('');
  const [fields, setFields] = useState<FieldReview[]>([]);
  const [openQuestions, setOpenQuestions] = useState<string[]>(initialQuestions);
  const [selectedQuestion, setSelectedQuestion] = useState(initialQuestions[0] ?? '');
  const [answer, setAnswer] = useState('');
  const [answerError, setAnswerError] = useState('');
  const [loadingAnswer, setLoadingAnswer] = useState(false);
  const [loadingScan, setLoadingScan] = useState(false);
  const [loadingFill, setLoadingFill] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [flashMessage, setFlashMessage] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    loadAiSettings().then(setAiSettings);
    loadRememberedResume().then(setRememberedResume);
    refreshPageSession();
  }, []);

  const buckets = useMemo(() => bucketFieldReviews(fields), [fields]);

  useEffect(() => {
    if (!selectedQuestion && openQuestions.length > 0) {
      setSelectedQuestion(openQuestions[0]);
    }
  }, [openQuestions, selectedQuestion]);

  async function refreshPageSession() {
    await withActiveTab(
      async (tabId) => {
        const response = await sendMessageToTab<{ pageSession?: PageSession }>(tabId, {
          type: 'GET_PAGE_SESSION'
        });

        if (response?.pageSession) {
          setPageSession(response.pageSession);
        }
      },
      undefined
    );
  }

  async function handleResumeFile(file: File) {
    const [resume, extractedText] = await Promise.all([rememberedResumeFromFile(file), importPdfResumeSafely(file)]);
    const nextResume = {
      ...resume,
      extractedText
    };

    await saveRememberedResume(nextResume);
    setRememberedResume(nextResume);
    setFlashMessage(
      extractedText
        ? 'Saved this resume for future application pages.'
        : 'Saved the resume, but readable PDF text was limited so some fields may still need review.'
    );
  }

  async function handleFileInputChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    await handleResumeFile(file);
    event.target.value = '';
  }

  async function handleDrop(event: React.DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];

    if (file) {
      await handleResumeFile(file);
    }
  }

  async function handleScan() {
    setLoadingScan(true);
    setFlashMessage('');
    let scanStarted = false;

    try {
      await withActiveTab(
        async (tabId) => {
          scanStarted = true;
          const response = await sendMessageToTab<ScanResult>(tabId, {
            type: 'SCAN_FIELDS'
          });
          const nextFields = response?.fields ?? [];

          if (response?.pageSession) {
            setPageSession(response.pageSession);
          }

          setFields(nextFields.map((field) => ({ label: field.label, status: 'unmatched' as const })));
          setFlashMessage(scanFlashMessage(nextFields));
        },
        undefined
      );
      if (!scanStarted) {
        setFlashMessage('Open the application page in the active tab before scanning.');
      }
    } catch (scanError) {
      const message = scanError instanceof Error ? scanError.message : 'Scan failed on this page.';
      setFlashMessage(message);
    } finally {
      setLoadingScan(false);
    }
  }

  async function handleSmartFill() {
    if (!rememberedResume) {
      setFlashMessage('Upload or replace your resume PDF first.');
      return;
    }

    setLoadingFill(true);
    setFlashMessage('');

    try {
      const currentSettings = await loadAiSettings();
      setAiSettings(currentSettings);

      await withActiveTab(
        async (tabId) => {
          let response: SmartFillResult;
          let usedAi = false;
          let fallbackToLocal = false;

          if (currentSettings.apiKey) {
            try {
              const scanResponse = await sendMessageToTab<ScanResult>(tabId, {
                type: 'SCAN_FIELDS'
              });
              const provider = createDeepSeekProvider(currentSettings);
              const plan = await planSmartFill(provider, {
                fields: scanResponse.fields ?? [],
                resumeText: rememberedResume.extractedText ?? '',
                jobDescription
              });

              response = await sendMessageToTab<SmartFillResult>(tabId, {
                type: 'APPLY_AI_SMART_FILL',
                suggestions: plan.suggestions
              });
              usedAi = true;
            } catch {
              response = await sendMessageToTab<SmartFillResult>(tabId, {
                type: 'SMART_FILL',
                resume: rememberedResume,
                jobDescription
              });
              fallbackToLocal = true;
            }
          } else {
            response = await sendMessageToTab<SmartFillResult>(tabId, {
              type: 'SMART_FILL',
              resume: rememberedResume,
              jobDescription
            });
          }

          if (response.pageSession) {
            setPageSession(response.pageSession);
          }

          setFields(response.fields ?? []);
          setOpenQuestions(response.openQuestions ?? []);
          setSelectedQuestion(response.openQuestions?.[0] ?? '');
          setFlashMessage(
            smartFillFlashMessage({
              fields: response.fields ?? [],
              usedAi,
              fallbackToLocal,
              resumeText: rememberedResume.extractedText
            })
          );
        },
        undefined
      );
    } catch (fillError) {
      const message = fillError instanceof Error ? fillError.message : 'Smart Fill failed.';
      setFlashMessage(message);
    } finally {
      setLoadingFill(false);
    }
  }

  async function handleUndo() {
    await withActiveTab(
      async (tabId) => {
        await sendMessageToTab(tabId, { type: 'UNDO_FILL' });
      },
      undefined
    );
    setFlashMessage('Reverted the last fill attempt on this page.');
    await refreshPageSession();
  }

  async function handleGenerateAnswer() {
    setLoadingAnswer(true);
    setAnswer('');
    setAnswerError('');

    try {
      const currentSettings = await loadAiSettings();
      setAiSettings(currentSettings);
      const provider = createDeepSeekProvider(currentSettings);
      const nextAnswer = await draftAnswer(provider, {
        question: selectedQuestion,
        profileSummary: trimResumePreview(rememberedResume?.extractedText),
        jobSummary: jobDescription
      });
      setAnswer(nextAnswer);
    } catch (generationError) {
      setAnswerError(generationError instanceof Error ? generationError.message : 'Failed to generate answer.');
    } finally {
      setLoadingAnswer(false);
    }
  }

  return (
    <main className="sidepanel-shell">
      <div className="sidepanel-column">
        <section className="hero-card">
          <p className="eyebrow">Application Copilot</p>
          <h1 className="hero-title">{theme.copy.title}</h1>
          <p className="hero-copy">
            Drop in your original resume PDF, paste the JD, and let the plugin fill the current application
            page directly. Low-confidence fields stay visible for review instead of being guessed silently.
          </p>

          <div className="status-row">
            <div className="status-pill" data-state={pageSession.confidence}>
              <strong>Page</strong> {pageSession.isApplicationPage ? 'Application detected' : 'Waiting for application page'}
            </div>
            <div className="status-pill" data-state={pageSession.status}>
              <strong>Status</strong> {pageSession.status}
            </div>
            <div className="status-pill">
              <strong>Domain</strong> {pageSession.domain || 'Current tab'}
            </div>
            <div className="status-pill">
              <strong>Fields</strong> {pageSession.recognizedFieldCount}
            </div>
          </div>
        </section>

        <section className="step-card">
          <div className="step-header">
            <div>
              <div className="step-label">
                <span>1</span> Resume
              </div>
              <h2>Drop your original resume PDF.</h2>
            </div>
          </div>

          <div className="upload-shell">
            <label
              className="upload-dropzone"
              data-dragging={dragging}
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
            >
              <input ref={fileInputRef} type="file" accept="application/pdf" onChange={handleFileInputChange} />
              <p className="upload-title">
                {rememberedResume ? 'Resume ready to reuse' : 'Drop your PDF here or click to browse'}
              </p>
              <p className="support-copy">
                We remember this file locally so you can jump straight into the next application page.
              </p>
            </label>

            {rememberedResume ? (
              <div className="meta-card">
                <strong>{rememberedResume.fileName}</strong>
                <p className="muted-copy">Updated {new Date(rememberedResume.updatedAt).toLocaleString()}</p>
                {trimResumePreview(rememberedResume.extractedText) ? (
                  <p className="muted-copy">{trimResumePreview(rememberedResume.extractedText)}...</p>
                ) : null}
                <div className="upload-actions">
                  <button type="button" className="button-secondary" onClick={() => fileInputRef.current?.click()}>
                    Replace resume
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="step-card">
          <div className="step-header">
            <div>
              <div className="step-label">
                <span>2</span> JD
              </div>
              <h2>Paste the job description.</h2>
            </div>
          </div>

          <div className="field">
            <label htmlFor="jobDescription">Full JD or key requirements</label>
            <textarea
              id="jobDescription"
              aria-label="Job Summary"
              value={jobDescription}
              onChange={(event) => setJobDescription(event.target.value)}
              placeholder="Paste the hiring page text, responsibilities, or required skills here."
            />
          </div>
        </section>

        <section className="step-card">
          <div className="step-header">
            <div>
              <div className="step-label">
                <span>3</span> Scan & Fill
              </div>
              <h2>Run the current page through Smart Fill.</h2>
            </div>
          </div>

          <p className="support-copy">
            Scan first if you want to preview the page shape, or jump straight to Smart Fill to write confident
            matches into the form right away.
          </p>

          <div className="action-row">
            <button type="button" className="button-secondary" onClick={handleScan} disabled={loadingScan}>
              {loadingScan ? 'Scanning...' : 'Scan page'}
            </button>
            <button type="button" className="button-primary" onClick={handleSmartFill} disabled={loadingFill}>
              {loadingFill ? 'Filling...' : theme.copy.primaryAction}
            </button>
            <button type="button" className="button-ghost" onClick={handleSmartFill} disabled={loadingFill}>
              Refill
            </button>
            <button type="button" className="button-ghost" onClick={handleUndo}>
              Undo
            </button>
          </div>

          {flashMessage ? <p className="success-text">{flashMessage}</p> : null}
        </section>

        <section className="step-card">
          <div className="step-header">
            <div>
              <div className="step-label">
                <span>4</span> Results
              </div>
              <h2>Review what was filled and what still needs you.</h2>
            </div>
          </div>

          <div className="summary-banner">{buckets.summary.label}</div>
          <div className="results-grid">
            <article>
              <h3>Filled automatically</h3>
              <p>High-confidence matches written straight into the page.</p>
              <ul className="result-list">
                {buckets.filled.length > 0 ? (
                  buckets.filled.map((field) => <li key={`filled-${field.label}`}>{field.label}</li>)
                ) : (
                  <li>No fields filled yet.</li>
                )}
              </ul>
            </article>

            <article>
              <h3>Needs your review</h3>
              <p>Useful drafts or fuzzy matches that should be checked before submit.</p>
              <ul className="result-list">
                {buckets.review.length > 0 ? (
                  buckets.review.map((field) => <li key={`review-${field.label}`}>{field.label}</li>)
                ) : (
                  <li>Nothing waiting on review.</li>
                )}
              </ul>
            </article>

            <article>
              <h3>Could not map</h3>
              <p>Fields we left untouched instead of guessing.</p>
              <ul className="result-list">
                {buckets.unmatched.length > 0 ? (
                  buckets.unmatched.map((field) => <li key={`unmatched-${field.label}`}>{field.label}</li>)
                ) : (
                  <li>No unmapped fields right now.</li>
                )}
              </ul>
            </article>
          </div>
        </section>

        {openQuestions.length > 0 ? (
          <section className="question-card">
            <div className="question-header">
              <div>
                <p className="eyebrow">Open Questions</p>
                <h2>Generate a stronger draft for long-form questions.</h2>
              </div>
            </div>

            <div className="field">
              <label htmlFor="selectedQuestion">Application question</label>
              <textarea
                id="selectedQuestion"
                className="compact"
                aria-label="Application Question"
                value={selectedQuestion}
                onChange={(event) => setSelectedQuestion(event.target.value)}
              />
            </div>

            <div className="field">
              <label htmlFor="profileSummary">Resume context</label>
              <textarea
                id="profileSummary"
                className="compact"
                aria-label="Profile Summary"
                value={trimResumePreview(rememberedResume?.extractedText)}
                readOnly
              />
            </div>

            <div className="field">
              <label htmlFor="questionJobSummary">Job summary</label>
              <textarea
                id="questionJobSummary"
                className="compact"
                aria-label="Question Job Summary"
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value)}
              />
            </div>

            <div className="answer-actions">
              <button type="button" className="button-primary" onClick={handleGenerateAnswer} disabled={loadingAnswer}>
                {loadingAnswer ? 'Generating...' : 'Generate Answer'}
              </button>
            </div>

            {answerError ? <p className="error-text">{answerError}</p> : null}
            {answer ? <pre>{answer}</pre> : null}
          </section>
        ) : null}

        <section className="footnote-card">
          <p className="muted-copy">
            DeepSeek provider: {aiSettings.model}. Export helpers are still available in code, but they are no
            longer the main action in this side panel.
          </p>
        </section>
      </div>
    </main>
  );
}
