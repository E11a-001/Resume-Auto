import { describe, expect, it } from 'vitest';
import { mapFieldToProfileKey } from '../../src/lib/forms/semantic-map';

describe('mapFieldToProfileKey', () => {
  it('treats work experience and internship experience as related but distinct concepts', () => {
    expect(
      mapFieldToProfileKey({
        label: 'Work Experience',
        sectionHeading: 'Experience'
      })
    ).toMatchObject({
      target: 'experiences',
      experienceTypes: ['full_time', 'internship']
    });

    expect(
      mapFieldToProfileKey({
        label: 'Internship Experience',
        sectionHeading: 'Experience'
      })
    ).toMatchObject({
      target: 'experiences',
      experienceTypes: ['internship']
    });
  });
});
