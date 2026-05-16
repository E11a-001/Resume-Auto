import { emptyProfile, type Profile } from '../schema/profile';

type ImportedExperience = {
  company: string;
  title: string;
  description?: string[];
};

type ImportedResume = Record<string, unknown> & {
  fullName?: string;
  internshipExperience?: ImportedExperience[];
  workExperience?: ImportedExperience[];
};

function buildExperience(
  entry: ImportedExperience,
  index: number,
  type: Profile['experiences'][number]['type']
) {
  return {
    id: `experience-${type}-${index}`,
    type,
    company: entry.company,
    title: entry.title,
    location: '',
    startDate: '',
    endDate: '',
    isCurrent: false,
    description: entry.description ?? []
  };
}

export function normalizeImportedResume(input: ImportedResume): Profile {
  const profile = emptyProfile();

  profile.fullName = input.fullName ?? '';
  profile.experiences = [
    ...(input.workExperience ?? []).map((entry, index) => buildExperience(entry, index, 'full_time')),
    ...(input.internshipExperience ?? []).map((entry, index) => buildExperience(entry, index, 'internship'))
  ];

  return profile;
}
