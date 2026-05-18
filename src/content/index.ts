import { fillField } from '../lib/forms/fill-fields';
import { readFieldLabel, scanFields } from '../lib/forms/scan-fields';
import { mapFieldToProfileKey } from '../lib/forms/semantic-map';
import type { SmartFillSuggestion } from '../lib/ai/smart-fill';
import {
  extractResumeNarratives,
  extractStructuredResumeEntries,
  pickNarrative,
  pickStructuredEntry,
  type StructuredResumeEntry
} from '../lib/import/resume-narratives';
import { extractJobKeywords, optimizeNarrativeForJob } from '../lib/jd/narrative-optimizer';
import type { RememberedResume } from '../lib/import/pdf-session-store';
import { detectApplicationPage } from '../lib/page/detect-application-page';
import type { PageSession } from '../lib/schema/page-session';
import type { FieldReview } from '../lib/state/app-state';

type FilledElementSnapshot = {
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  value: string;
};

type SmartFillResponse = {
  pageSession: PageSession;
  fields: FieldReview[];
  openQuestions: string[];
};

let lastFilledSnapshots: FilledElementSnapshot[] = [];

function extractResumeFacts(resume: RememberedResume | null) {
  const text = resume?.extractedText?.replace(/\s+/g, ' ').trim() ?? '';
  const lines = text
    .split(/(?<=[.!?])\s+|\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
  const rawLines = (resume?.extractedText ?? '')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  const email = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0] ?? '';
  const phone = text.match(/(?:\+?\d[\d\s().-]{7,}\d)/)?.[0]?.replace(/\s+/g, ' ').trim() ?? '';
  const urls = Array.from(text.matchAll(/https?:\/\/[^\s]+/g)).map((match) => match[0]);
  const linkedin = urls.find((url) => url.toLowerCase().includes('linkedin')) ?? '';
  const github = urls.find((url) => url.toLowerCase().includes('github')) ?? '';
  const portfolio = urls.find((url) => !url.toLowerCase().includes('linkedin') && !url.toLowerCase().includes('github')) ?? '';
  const fullName =
    rawLines.find((line) => line.length >= 4 && line.length <= 48 && !/@|https?:\/\//i.test(line) && !/\d{4,}/.test(line)) ??
    '';
  const location =
    rawLines.find(
      (line) =>
        line.includes(',') &&
        !line.includes('@') &&
        !/^https?:\/\//i.test(line) &&
        line.length <= 48
    ) ?? '';
  const profileSummary = lines.slice(0, 3).join(' ');
  const experienceSummary = lines
    .filter((line) => /experience|intern|engineer|analyst|manager|research|product|develop/i.test(line))
    .slice(0, 4)
    .join(' ');

  return {
    fullName,
    email,
    phone,
    location,
    linkedin,
    github,
    portfolio,
    profileSummary,
    experienceSummary
  };
}

function narrativeKindForField(mapping: ReturnType<typeof mapFieldToProfileKey>) {
  if (mapping.target === 'projectDescription') {
    return 'project' as const;
  }

  if (mapping.target !== 'experienceDescription') {
    return null;
  }

  const experienceTypes = mapping.experienceTypes ? [...mapping.experienceTypes] : [];

  if (experienceTypes.includes('internship') && !experienceTypes.includes('full_time')) {
    return 'internship' as const;
  }

  return 'work' as const;
}

function entryKindForField(mapping: ReturnType<typeof mapFieldToProfileKey>) {
  if (mapping.target === 'projectName' || mapping.target === 'projectDescription') {
    return 'project' as const;
  }

  if (mapping.target !== 'companyName' && mapping.target !== 'jobTitle' && mapping.target !== 'experienceDescription') {
    return null;
  }

  const experienceTypes = mapping.experienceTypes ? [...mapping.experienceTypes] : [];

  if (experienceTypes.includes('internship') && !experienceTypes.includes('full_time')) {
    return 'internship' as const;
  }

  return 'work' as const;
}

type StructuredEntryState = Record<
  'internship' | 'work' | 'project',
  {
    index: number;
    current: StructuredResumeEntry | null;
  }
>;

function resolveStructuredEntry(
  kind: 'internship' | 'work' | 'project',
  mapping: ReturnType<typeof mapFieldToProfileKey>,
  structuredEntries: ReturnType<typeof extractStructuredResumeEntries>,
  structuredState: StructuredEntryState
) {
  const state = structuredState[kind];
  const startsEntry = mapping.target === 'companyName' || mapping.target === 'projectName';

  if (!state.current) {
    state.current = pickStructuredEntry(
      structuredEntries,
      kind,
      {
        internship: structuredState.internship.index,
        work: structuredState.work.index,
        project: structuredState.project.index
      }
    );

    if (state.current) {
      state.index += 1;
    }

    return state.current;
  }

  if (startsEntry) {
    const nextEntry = structuredEntries[kind][state.index] ?? null;

    if (nextEntry) {
      state.current = nextEntry;
      state.index += 1;
    }
  }

  return state.current;
}

function buildQuestionDraft(
  facts: ReturnType<typeof extractResumeFacts>,
  jobDescription: string
) {
  const keywords = extractJobKeywords(jobDescription);
  const keywordText = keywords.length > 0 ? ` aligned with ${keywords.slice(0, 3).join(', ')}` : '';
  const summary = optimizeNarrativeForJob(
    facts.experienceSummary || facts.profileSummary || 'hands-on analytical and operational work',
    jobDescription
  );

  return `I am excited about this opportunity because my background in ${summary}${keywordText} matches the role's priorities. I can contribute quickly, learn fast, and communicate clearly while keeping the work grounded in real execution.`;
}

function findSectionHeading(element: Element) {
  return element.closest('section, fieldset, form')?.querySelector('legend, h1, h2, h3')?.textContent?.trim();
}

function buildFieldValue(
  label: string,
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  facts: ReturnType<typeof extractResumeFacts>,
  jobDescription: string,
  narratives: ReturnType<typeof extractResumeNarratives>,
  structuredEntries: ReturnType<typeof extractStructuredResumeEntries>,
  narrativeCursor: Record<'internship' | 'work' | 'project' | 'experience', number>,
  structuredState: StructuredEntryState
) {
  const mapping = mapFieldToProfileKey({
    label,
    sectionHeading: findSectionHeading(element) ?? undefined
  });
  const narrativeKind = narrativeKindForField(mapping);
  const entryKind = entryKindForField(mapping);

  if (entryKind && (mapping.target === 'companyName' || mapping.target === 'jobTitle' || mapping.target === 'projectName')) {
    const entry = resolveStructuredEntry(entryKind, mapping, structuredEntries, structuredState);

    if (entry) {
      if (mapping.target === 'companyName' && entry.company) {
        return { value: entry.company, status: 'needs-confirmation' as const };
      }

      if (mapping.target === 'jobTitle' && entry.title) {
        return { value: entry.title, status: 'needs-confirmation' as const };
      }

      if (mapping.target === 'projectName' && entry.name) {
        return { value: entry.name, status: 'needs-confirmation' as const };
      }
    }
  }

  if (mapping.target === 'email' && facts.email) {
    return { value: facts.email, status: 'autofilled' as const };
  }

  if (mapping.target === 'fullName' && facts.fullName) {
    return { value: facts.fullName, status: 'autofilled' as const };
  }

  if (mapping.target === 'phone' && facts.phone) {
    return { value: facts.phone, status: 'autofilled' as const };
  }

  if (mapping.target === 'location' && facts.location) {
    return { value: facts.location, status: 'autofilled' as const };
  }

  if (mapping.target === 'linkedin' && facts.linkedin) {
    return { value: facts.linkedin, status: 'autofilled' as const };
  }

  if (mapping.target === 'github' && facts.github) {
    return { value: facts.github, status: 'autofilled' as const };
  }

  if (mapping.target === 'portfolio' && facts.portfolio) {
    return { value: facts.portfolio, status: 'autofilled' as const };
  }

  if (mapping.target === 'experiences' && facts.experienceSummary) {
    return { value: facts.experienceSummary, status: 'needs-confirmation' as const };
  }

  if (entryKind && mapping.target === 'experienceDescription' && (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) {
    const entry = resolveStructuredEntry(entryKind, mapping, structuredEntries, structuredState);

    if (entry?.description) {
      return {
        value: optimizeNarrativeForJob(entry.description, jobDescription),
        status: 'needs-confirmation' as const
      };
    }
  }

  if (narrativeKind && (element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) {
    const narrative = pickNarrative(narratives, narrativeKind, narrativeCursor);

    if (narrative) {
      return {
        value: optimizeNarrativeForJob(narrative, jobDescription),
        status: 'needs-confirmation' as const
      };
    }
  }

  if (mapping.target === 'profileSummary' && facts.profileSummary) {
    const keywords = extractJobKeywords(jobDescription);
    const text = `${facts.profileSummary}${keywords.length > 0 ? ` Focused on ${keywords.join(', ')}.` : ''}`.trim();
    return { value: text, status: 'needs-confirmation' as const };
  }

  if (mapping.target === 'openQuestion' && element instanceof HTMLTextAreaElement) {
    return { value: buildQuestionDraft(facts, jobDescription), status: 'needs-confirmation' as const };
  }

  return { value: '', status: 'unmatched' as const };
}

function smartFillDocument(resume: RememberedResume | null, jobDescription: string): SmartFillResponse {
  const fields: FieldReview[] = [];
  const openQuestions: string[] = [];
  const pageSession = detectApplicationPage(document);
  const facts = extractResumeFacts(resume);
  const narratives = extractResumeNarratives(resume);
  const structuredEntries = extractStructuredResumeEntries(resume);
  const narrativeCursor = {
    internship: 0,
    work: 0,
    project: 0,
    experience: 0
  };
  const structuredState: StructuredEntryState = {
    internship: { index: 0, current: null },
    work: { index: 0, current: null },
    project: { index: 0, current: null }
  };
  const elements = document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(
    'input, textarea, select'
  );

  lastFilledSnapshots = [];

  elements.forEach((element) => {
    if (element instanceof HTMLInputElement && element.type === 'file') {
      return;
    }

    const label = readFieldLabel(element);

    if (!label) {
      return;
    }

    const next = buildFieldValue(
      label,
      element,
      facts,
      jobDescription,
      narratives,
      structuredEntries,
      narrativeCursor,
      structuredState
    );

    if (next.value && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
      lastFilledSnapshots.push({ element, value: element.value });
      fillField(element, next.value);
      fields.push({ label, status: next.status, value: next.value });

      if (next.status === 'needs-confirmation' && element instanceof HTMLTextAreaElement) {
        openQuestions.push(label);
      }

      return;
    }

    if (!next.value && element instanceof HTMLTextAreaElement) {
      openQuestions.push(label);
      fields.push({ label, status: 'needs-confirmation' });
      return;
    }

    fields.push({ label, status: 'unmatched' });
  });

  return {
    pageSession: {
      ...pageSession,
      status: fields.some((field) => field.status !== 'unmatched') ? 'filled' : pageSession.status
    },
    fields,
    openQuestions
  };
}

function applyAiSmartFillPlan(suggestions: SmartFillSuggestion[]): SmartFillResponse {
  const fields: FieldReview[] = [];
  const openQuestions: string[] = [];
  const pageSession = detectApplicationPage(document);
  const elements = Array.from(
    document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>('input, textarea, select')
  );
  const suggestionMap = new Map(suggestions.map((suggestion) => [suggestion.id, suggestion]));

  lastFilledSnapshots = [];

  elements.forEach((element, index) => {
    if (element instanceof HTMLInputElement && element.type === 'file') {
      return;
    }

    const label = readFieldLabel(element);

    if (!label) {
      return;
    }

    const suggestion = suggestionMap.get(`field-${index}`);

    if (!suggestion) {
      fields.push({ label, status: 'unmatched' });
      return;
    }

    if (suggestion.value) {
      lastFilledSnapshots.push({ element, value: element.value });
      fillField(element, suggestion.value);
      fields.push({ label, status: suggestion.status, value: suggestion.value });

      if (suggestion.status === 'needs-confirmation' && element instanceof HTMLTextAreaElement) {
        openQuestions.push(label);
      }

      return;
    }

    if (suggestion.status === 'needs-confirmation' && element instanceof HTMLTextAreaElement) {
      openQuestions.push(label);
    }

    fields.push({ label, status: suggestion.status });
  });

  return {
    pageSession: {
      ...pageSession,
      status: fields.some((field) => field.status !== 'unmatched') ? 'filled' : pageSession.status
    },
    fields,
    openQuestions
  };
}

function undoLastFill() {
  lastFilledSnapshots.forEach(({ element, value }) => {
    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
      fillField(element, value);
      return;
    }

    element.value = value;
    element.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

function mountFloatingBadge(pageSession: PageSession) {
  if (!pageSession.isApplicationPage || document.getElementById('resume-autofill-float')) {
    return;
  }

  const button = document.createElement('button');
  button.id = 'resume-autofill-float';
  button.type = 'button';
  button.textContent = 'Resume Autofill ready';
  button.style.position = 'fixed';
  button.style.right = '20px';
  button.style.bottom = '20px';
  button.style.zIndex = '2147483647';
  button.style.border = '1px solid rgba(23,23,23,0.12)';
  button.style.borderRadius = '999px';
  button.style.background = 'rgba(255,255,255,0.96)';
  button.style.color = '#171717';
  button.style.padding = '10px 14px';
  button.style.fontSize = '12px';
  button.style.fontWeight = '600';
  button.style.boxShadow = '0 12px 24px rgba(0,0,0,0.12)';
  button.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'OPEN_SIDEPANEL' }).catch(() => {
      return undefined;
    });
  });
  document.body.appendChild(button);
}

mountFloatingBadge(detectApplicationPage(document));

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'PING') {
    sendResponse({ ok: true });
  }

  if (message?.type === 'GET_PAGE_SESSION') {
    sendResponse({ pageSession: detectApplicationPage(document) });
  }

  if (message?.type === 'SCAN_FIELDS') {
    const pageSession = detectApplicationPage(document);
    sendResponse({
      pageSession: {
        ...pageSession,
        status: pageSession.isApplicationPage ? 'ready-to-fill' : pageSession.status
      },
      fields: scanFields(document)
    });
  }

  if (message?.type === 'SMART_FILL') {
    sendResponse(smartFillDocument(message.resume ?? null, message.jobDescription ?? ''));
  }

  if (message?.type === 'APPLY_AI_SMART_FILL') {
    sendResponse(applyAiSmartFillPlan(message.suggestions ?? []));
  }

  if (message?.type === 'UNDO_FILL') {
    undoLastFill();
    sendResponse({ ok: true });
  }

  return true;
});
