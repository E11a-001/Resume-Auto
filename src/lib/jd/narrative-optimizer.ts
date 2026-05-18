export function extractJobKeywords(jobDescription: string) {
  return Array.from(new Set(jobDescription.match(/\b[A-Za-z][A-Za-z0-9+-]{3,}\b/g) ?? [])).slice(0, 6);
}

export function optimizeNarrativeForJob(description: string, jobDescription: string) {
  const clauses = description
    .split(/(?<=[。！？.!?])\s+|[；;]+/)
    .map((clause) => clause.trim())
    .filter(Boolean);

  if (clauses.length <= 1) {
    return description;
  }

  const keywords = extractJobKeywords(jobDescription).map((keyword) => keyword.toLowerCase());

  if (keywords.length === 0) {
    return description;
  }

  const scored = clauses.map((clause, index) => {
    const lowered = clause.toLowerCase();
    const score = keywords.reduce((total, keyword) => total + (lowered.includes(keyword) ? 1 : 0), 0);

    return {
      clause,
      index,
      score
    };
  });

  const hasSignal = scored.some((entry) => entry.score > 0);

  if (!hasSignal) {
    return description;
  }

  return scored
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.clause)
    .join(' ')
    .trim();
}
