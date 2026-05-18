import type { PageSession } from '../schema/page-session';

const APPLICATION_TERMS = [
  'apply',
  'application',
  'resume',
  'cv',
  'work experience',
  'education',
  '实习经历',
  '教育经历',
  '在校职务',
  '获奖情况',
  '职位名称'
];
const JOB_FIELD_TERMS = [
  'full name',
  'email',
  'phone',
  'linkedin',
  'github',
  'portfolio',
  'work experience',
  'education',
  'why do you want',
  'cover letter',
  '开始时间',
  '结束时间',
  '单位名称',
  '职位名称',
  '实习部门',
  '证明人',
  '职务描述',
  '学生干部层级'
];

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
  const matchedFieldTerms = JOB_FIELD_TERMS.filter((term) => text.includes(term));
  const recognizedFieldCount = documentNode.querySelectorAll('input, textarea, select').length;
  const isApplicationPage =
    (matchedTerms.length >= 2 && recognizedFieldCount >= 3) ||
    (matchedFieldTerms.length >= 3 && recognizedFieldCount >= 4);

  return {
    isApplicationPage,
    confidence:
      isApplicationPage && (matchedTerms.length >= 3 || matchedFieldTerms.length >= 5)
        ? 'high'
        : isApplicationPage
          ? 'medium'
          : 'low',
    domain: documentNode.location.hostname,
    recognizedFieldCount,
    status: 'not-ready'
  };
}
