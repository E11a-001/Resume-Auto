import { describe, expect, it } from 'vitest';
import { normalizeImportedResume } from '../../src/lib/import/profile-normalizer';

describe('normalizeImportedResume', () => {
  it('maps internship entries into the shared experiences collection', () => {
    const profile = normalizeImportedResume({
      fullName: 'Ella Example',
      internshipExperience: [
        {
          company: 'OpenAI',
          title: 'Research Intern',
          description: ['Built evaluation tooling']
        }
      ]
    });

    expect(profile.experiences).toHaveLength(1);
    expect(profile.experiences[0]).toMatchObject({
      type: 'internship',
      company: 'OpenAI',
      title: 'Research Intern'
    });
  });
});
