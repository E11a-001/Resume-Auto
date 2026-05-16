import type { PageSession } from '../schema/page-session';

const APPLICATION_TERMS = ['apply', 'application', 'resume', 'cv', 'work experience', 'education'];

function collectPageText(documentNode: Document) {
  const bodyText = documentNode.body?.textContent ?? '';
  const labelText = Array.from(documentNode.querySelectorAll('label'))
    .map((label) => label.textContent?.trim() ?? '')
    .join(' ');

  return `${bodyText} ${labelText}`.toLowerCase();
}

export function detectApplicationPage(documentNode: Document): PageSession {
  const text = collectPageText(documentNode);
  const matchedTerms = APPLICATION_TERMS.filter((term) => text.includes(term));
  const recognizedFieldCount = documentNode.querySelectorAll('input, textarea, select').length;
  const isApplicationPage = matchedTerms.length >= 2 && recognizedFieldCount >= 3;

  return {
    isApplicationPage,
    confidence: isApplicationPage && matchedTerms.length >= 3 ? 'high' : isApplicationPage ? 'medium' : 'low',
    domain: documentNode.location.hostname,
    recognizedFieldCount,
    status: 'not-ready'
  };
}
