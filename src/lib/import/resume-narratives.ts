import type { RememberedResume } from './pdf-session-store';

type NarrativeKind = 'internship' | 'work' | 'project' | 'experience';
type EntryKind = 'internship' | 'work' | 'project';

type NarrativeBuckets = {
  internship: string[];
  work: string[];
  project: string[];
  experience: string[];
};

export type StructuredResumeEntry = {
  kind: EntryKind;
  company: string;
  title: string;
  name: string;
  description: string;
};

const sectionMatchers: Array<{ kind: Exclude<NarrativeKind, 'experience'>; pattern: RegExp }> = [
  { kind: 'internship', pattern: /(internship|intern experience|实习经历|实习项目)/i },
  { kind: 'project', pattern: /(projects?|project experience|项目经历|项目经验|项目)/i },
  { kind: 'work', pattern: /(work experience|professional experience|employment|工作经历|职业经历)/i }
];

function normalizeLine(line: string) {
  return line.replace(/\s+/g, ' ').trim();
}

function stripDateTokens(text: string) {
  return normalizeLine(
    text
      .replace(/\b(19|20)\d{2}[./-]\d{1,2}(?:\s*[-–—~至]+\s*(?:(19|20)\d{2}[./-]\d{1,2}|至今|present|current))?/gi, ' ')
      .replace(/\b(19|20)\d{2}\b/g, ' ')
  );
}

function isSectionHeading(line: string) {
  return sectionMatchers.some(({ pattern }) => pattern.test(line));
}

function sectionKind(line: string): Exclude<NarrativeKind, 'experience'> | null {
  return sectionMatchers.find(({ pattern }) => pattern.test(line))?.kind ?? null;
}

function isLikelyDateOrShortHeader(line: string) {
  const normalized = normalizeLine(line);

  if (!normalized) {
    return false;
  }

  if (normalized.length <= 3) {
    return true;
  }

  return (
    /\b(19|20)\d{2}\b/.test(normalized) ||
    /\d{1,2}[./-]\d{1,2}/.test(normalized) ||
    /\d{4}[./-]\d{1,2}/.test(normalized) ||
    /(至今|present|current)/i.test(normalized)
  );
}

function isDescriptiveLine(line: string) {
  const normalized = normalizeLine(line);

  if (!normalized) {
    return false;
  }

  if (/[@]|https?:\/\//i.test(normalized)) {
    return false;
  }

  if (isSectionHeading(normalized) || isLikelyDateOrShortHeader(normalized)) {
    return false;
  }

  return normalized.length >= 12;
}

function pushChunk(chunks: string[], lines: string[]) {
  const normalizedLines = lines.map(normalizeLine).filter(Boolean);

  if (normalizedLines.length === 0) {
    return;
  }

  const text = normalizedLines.join(' ').replace(/\s+/g, ' ').trim();

  if (text.length < 20) {
    return;
  }

  chunks.push(text);
}

function pushEntry(entries: StructuredResumeEntry[], entry: StructuredResumeEntry | null) {
  if (!entry) {
    return;
  }

  const normalizedDescription = normalizeLine(entry.description);

  if (!normalizedDescription) {
    return;
  }

  entries.push({
    ...entry,
    description: normalizedDescription
  });
}

function collectSectionChunks(lines: string[], kind: Exclude<NarrativeKind, 'experience'>) {
  const chunks: string[] = [];
  let currentLines: string[] = [];
  let insideSection = false;

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine);

    if (!line) {
      pushChunk(chunks, currentLines);
      currentLines = [];
      continue;
    }

    const nextSectionKind = sectionKind(line);

    if (nextSectionKind) {
      if (insideSection) {
        pushChunk(chunks, currentLines);
        currentLines = [];
      }

      insideSection = nextSectionKind === kind;
      continue;
    }

    if (!insideSection) {
      continue;
    }

    if (isLikelyDateOrShortHeader(line) && currentLines.length > 0) {
      pushChunk(chunks, currentLines);
      currentLines = [];
      continue;
    }

    if (isDescriptiveLine(line)) {
      currentLines.push(line);
    }
  }

  pushChunk(chunks, currentLines);

  return chunks;
}

function collectFallbackChunks(lines: string[], pattern: RegExp) {
  return lines.filter((line) => isDescriptiveLine(line) && pattern.test(line)).map(normalizeLine);
}

function dedupeChunks(chunks: string[]) {
  return Array.from(new Set(chunks.map((chunk) => chunk.replace(/\s+/g, ' ').trim()).filter(Boolean)));
}

function titleLike(text: string) {
  return /(实习|工程师|经理|分析师|运营|产品|开发|研究|助理|顾问|intern|engineer|manager|analyst|research|product|developer|assistant)/i.test(
    text
  );
}

function splitHeader(kind: EntryKind, headerLines: string[]) {
  const cleanedHeaderLines = headerLines.map(stripDateTokens).filter(Boolean);
  const primary = cleanedHeaderLines[0] ?? '';
  const secondary = cleanedHeaderLines[1] ?? '';

  if (kind === 'project') {
    return {
      company: '',
      title: '',
      name: primary || secondary
    };
  }

  if (cleanedHeaderLines.length >= 2) {
    return {
      company: primary,
      title: secondary,
      name: ''
    };
  }

  const parts = primary.split(/\s{2,}|\s[|/·]\s|\s+/).filter(Boolean);

  if (parts.length >= 2) {
    const first = parts[0] ?? '';
    const rest = parts.slice(1).join(' ').trim();

    if (titleLike(rest)) {
      return {
        company: first,
        title: rest,
        name: ''
      };
    }
  }

  return {
    company: primary,
    title: titleLike(primary) ? primary : '',
    name: ''
  };
}

function looksLikeEntryHeader(line: string, position: number) {
  const normalized = stripDateTokens(line);

  if (!normalized) {
    return false;
  }

  if (position === 0) {
    return normalized.length <= 36 || titleLike(normalized);
  }

  return position === 1 && normalized.length <= 28 && !isDescriptiveLine(normalized);
}

function buildStructuredEntry(kind: EntryKind, lines: string[]) {
  const normalizedLines = lines.map(normalizeLine).filter(Boolean);

  if (normalizedLines.length === 0) {
    return null;
  }

  const headerLines: string[] = [];
  const descriptionLines: string[] = [];
  let bodyStarted = false;

  normalizedLines.forEach((line, index) => {
    if (!bodyStarted && looksLikeEntryHeader(line, index)) {
      headerLines.push(line);
      return;
    }

    bodyStarted = true;
    descriptionLines.push(line);
  });

  if (descriptionLines.length === 0 && normalizedLines.length > 1) {
    headerLines.length = 0;
    headerLines.push(normalizedLines[0]);
    descriptionLines.push(...normalizedLines.slice(1));
  }

  if (descriptionLines.length === 0) {
    return null;
  }

  const header = splitHeader(kind, headerLines);

  return {
    kind,
    company: header.company,
    title: header.title,
    name: header.name,
    description: descriptionLines.join(' ')
  } satisfies StructuredResumeEntry;
}

function collectStructuredEntries(lines: string[], kind: EntryKind) {
  const entries: StructuredResumeEntry[] = [];
  let currentLines: string[] = [];
  let insideSection = false;

  for (const rawLine of lines) {
    const line = normalizeLine(rawLine);

    if (!line) {
      pushEntry(entries, buildStructuredEntry(kind, currentLines));
      currentLines = [];
      continue;
    }

    const nextSectionKind = sectionKind(line);

    if (nextSectionKind) {
      if (insideSection) {
        pushEntry(entries, buildStructuredEntry(kind, currentLines));
        currentLines = [];
      }

      insideSection = nextSectionKind === kind;
      continue;
    }

    if (!insideSection) {
      continue;
    }

    if (isLikelyDateOrShortHeader(line) && currentLines.length > 0 && currentLines.some(isDescriptiveLine)) {
      pushEntry(entries, buildStructuredEntry(kind, currentLines));
      currentLines = [line];
      continue;
    }

    currentLines.push(line);
  }

  pushEntry(entries, buildStructuredEntry(kind, currentLines));
  return entries;
}

export function extractResumeNarratives(resume: RememberedResume | null): NarrativeBuckets {
  const rawLines = (resume?.extractedText ?? '').split('\n').map((line) => line.trim());

  const internship = dedupeChunks([
    ...collectSectionChunks(rawLines, 'internship'),
    ...collectFallbackChunks(rawLines, /(intern|实习|校内实践)/i)
  ]);
  const work = dedupeChunks([
    ...collectSectionChunks(rawLines, 'work'),
    ...collectFallbackChunks(rawLines, /(work|experience|职责|负责|工作|运营|分析|产品|开发)/i)
  ]);
  const project = dedupeChunks([
    ...collectSectionChunks(rawLines, 'project'),
    ...collectFallbackChunks(rawLines, /(project|项目|成果|落地|优化|搭建|实现)/i)
  ]);
  const experience = dedupeChunks([...internship, ...work]);

  return {
    internship,
    work,
    project,
    experience
  };
}

export function extractStructuredResumeEntries(resume: RememberedResume | null) {
  const rawLines = (resume?.extractedText ?? '').split('\n').map((line) => line.trim());

  return {
    internship: collectStructuredEntries(rawLines, 'internship'),
    work: collectStructuredEntries(rawLines, 'work'),
    project: collectStructuredEntries(rawLines, 'project')
  };
}

export function pickNarrative(
  buckets: NarrativeBuckets,
  kind: NarrativeKind,
  cursor: Record<NarrativeKind, number>
) {
  const options =
    kind === 'internship'
      ? [...buckets.internship, ...buckets.experience]
      : kind === 'work'
        ? [...buckets.work, ...buckets.experience]
        : kind === 'project'
          ? buckets.project
          : buckets.experience;

  const index = cursor[kind];
  const value = options[index] ?? options[0] ?? '';

  if (!value) {
    return '';
  }

  cursor[kind] += 1;
  return value;
}

export function pickStructuredEntry(
  entries: Record<EntryKind, StructuredResumeEntry[]>,
  kind: EntryKind,
  cursor: Record<EntryKind, number>
) {
  const options =
    kind === 'work'
      ? entries.work.length > 0
        ? entries.work
        : entries.internship
      : kind === 'internship'
        ? entries.internship.length > 0
          ? entries.internship
          : entries.work
        : entries.project;
  const index = cursor[kind];
  const entry = options[index] ?? options[0] ?? null;

  if (!entry) {
    return null;
  }

  cursor[kind] += 1;
  return entry;
}
