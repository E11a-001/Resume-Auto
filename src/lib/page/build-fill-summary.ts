export function buildFillSummary(filled: number, review: number, unmapped: number) {
  return {
    filled,
    review,
    unmapped,
    label: `${filled} filled · ${review} need review · ${unmapped} unmapped`
  };
}
