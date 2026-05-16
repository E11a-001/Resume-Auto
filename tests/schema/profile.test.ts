import { describe, expect, it } from 'vitest';
import { emptyProfile } from '../../src/lib/schema/profile';

describe('emptyProfile', () => {
  it('creates a local-first starter profile', () => {
    expect(emptyProfile().experiences).toEqual([]);
    expect(emptyProfile().languages).toEqual([]);
  });
});
