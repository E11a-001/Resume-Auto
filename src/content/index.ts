import { fillField } from '../lib/forms/fill-fields';
import { readFieldLabel, scanFields } from '../lib/forms/scan-fields';
import { mapFieldToProfileKey } from '../lib/forms/semantic-map';
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

function jdKeywords(jobDescription: string) {
  return Array.from(new Set(jobDescription.match(/\b[A-Za-z][A-Za-z0-9+-]{3,}\b/g) ?? [])).slice(0, 6);
}

function buildQuestionDraft(
  facts: ReturnType<typeof extractResumeFacts>,
  jobDescription: string
) {
  const keywords = jdKeywords(jobDescription);
  const keywordText = keywords.length > 0 ? ` aligned with ${keywords.slice(0, 3).join(', ')}` : '';
  const summary = facts.experienceSummary || facts.profileSummary || 'hands-on analytical and operational work';

  return `I am excited about this opportunity because my background in ${summary}${keywordText} matches the role's priorities. I can contribute quickly, learn fast, and communicate clearly while keeping the work grounded in real execution.`;
}

function findSectionHeading(element: Element) {
  return element.closest('section, fieldset, form')?.querySelector('legend, h1, h2, h3')?.textContent?.trim();
}

function buildFieldValue(
  label: string,
  element: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement,
  facts: ReturnType<typeof extractResumeFacts>,
  jobDescription: string
) {
  const mapping = mapFieldToProfileKey({
    label,
    sectionHeading: findSectionHeading(element) ?? undefined
  });

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

  if (mapping.target === 'profileSummary' && facts.profileSummary) {
    const keywords = jdKeywords(jobDescription);
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

    const next = buildFieldValue(label, element, facts, jobDescription);

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

  if (message?.type === 'UNDO_FILL') {
    undoLastFill();
    sendResponse({ ok: true });
  }

  return true;
});
