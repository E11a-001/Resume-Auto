import type { JobContext } from '../schema/job-context';

function keywordCandidates(text: string) {
  return Array.from(new Set(text.match(/\b[\p{L}][\p{L}\p{N}-]{3,}\b/gu) ?? [])).slice(0, 20);
}

export function extractJobContext(documentNode: Document): JobContext {
  const roleTitle = documentNode.querySelector('h1')?.textContent?.trim() ?? '';
  const company =
    documentNode.querySelector('[data-company], .company, [class*="company"]')?.textContent?.trim() ??
    documentNode.location.hostname;

  return {
    company,
    roleTitle,
    keywords: keywordCandidates(documentNode.body.innerText)
  };
}
