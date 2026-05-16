import { describe, expect, it } from 'vitest';
import { bucketFieldReviews } from '../../src/lib/forms/review-buckets';

describe('bucketFieldReviews', () => {
  it('splits field reviews into filled, review, and unmatched buckets', () => {
    const buckets = bucketFieldReviews([
      { label: 'Email', status: 'autofilled', value: 'ella@example.com' },
      { label: 'Why this role?', status: 'needs-confirmation' },
      { label: 'Visa status', status: 'unmatched' }
    ]);

    expect(buckets.filled).toHaveLength(1);
    expect(buckets.review).toHaveLength(1);
    expect(buckets.unmatched).toHaveLength(1);
    expect(buckets.summary.label).toBe('1 filled · 1 need review · 1 unmapped');
  });
});
