import { describe, expect, it } from 'vitest';
import { buildTailoredResumeVersion } from '../../src/lib/jd/build-tailored-version';
import { emptyProfile } from '../../src/lib/schema/profile';

describe('buildTailoredResumeVersion', () => {
  it('creates a new JD-specific resume version without mutating the source profile', () => {
    const source = {
      ...emptyProfile(),
      fullName: 'Ella Example',
      experiences: [
        {
          id: '1',
          type: 'internship' as const,
          company: 'OpenAI',
          title: 'Research Intern',
          location: '',
          startDate: '',
          endDate: '',
          isCurrent: false,
          description: ['Built eval tooling']
        }
      ],
      skills: ['Python']
    };

    const version = buildTailoredResumeVersion(source, {
      company: 'Example Corp',
      roleTitle: 'ML Engineer',
      keywords: ['evaluation', 'python']
    });

    expect(version.name).toBe('Example Corp - ML Engineer - v1');
    expect(source).toMatchObject({ fullName: 'Ella Example' });
    expect(version.profile.skills).toContain('Python');
  });
});
