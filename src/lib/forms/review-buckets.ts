import { buildFillSummary } from '../page/build-fill-summary';
import type { FieldReview } from '../state/app-state';

export function bucketFieldReviews(fields: FieldReview[]) {
  const filled = fields.filter((field) => field.status === 'autofilled');
  const review = fields.filter((field) => field.status === 'needs-confirmation');
  const unmatched = fields.filter((field) => field.status === 'unmatched');

  return {
    filled,
    review,
    unmatched,
    summary: buildFillSummary(filled.length, review.length, unmatched.length)
  };
}
