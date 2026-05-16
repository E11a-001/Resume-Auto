export type FieldDescriptor = {
  label: string;
  sectionHeading?: string;
};

export function mapFieldToProfileKey(field: FieldDescriptor) {
  const normalized = `${field.sectionHeading ?? ''} ${field.label}`.toLowerCase();
  const hasStandaloneName = /\bname\b/.test(normalized) && !normalized.includes('company name');

  if (
    normalized.includes('full name') ||
    normalized.includes('legal name') ||
    normalized.includes('first name') ||
    normalized.includes('last name') ||
    hasStandaloneName ||
    normalized.includes('姓名')
  ) {
    return {
      target: 'fullName',
      confidence: normalized.includes('name') ? 'high' : 'medium'
    } as const;
  }

  if (normalized.includes('internship') || normalized.includes('实习')) {
    return {
      target: 'experiences',
      experienceTypes: ['internship'],
      confidence: 'high'
    } as const;
  }

  if (
    normalized.includes('work experience') ||
    normalized.includes('employment') ||
    normalized.includes('professional experience') ||
    normalized.includes('工作经历')
  ) {
    return {
      target: 'experiences',
      experienceTypes: ['full_time', 'internship'],
      confidence: 'medium'
    } as const;
  }

  if (normalized.includes('email') || normalized.includes('邮箱')) {
    return {
      target: 'email',
      confidence: 'high'
    } as const;
  }

  if (normalized.includes('phone') || normalized.includes('mobile') || normalized.includes('电话')) {
    return {
      target: 'phone',
      confidence: 'high'
    } as const;
  }

  if (
    normalized.includes('location') ||
    normalized.includes('city') ||
    normalized.includes('address') ||
    normalized.includes('地区')
  ) {
    return {
      target: 'location',
      confidence: 'medium'
    } as const;
  }

  if (normalized.includes('linkedin')) {
    return {
      target: 'linkedin',
      confidence: 'high'
    } as const;
  }

  if (normalized.includes('github')) {
    return {
      target: 'github',
      confidence: 'high'
    } as const;
  }

  if (normalized.includes('portfolio') || normalized.includes('website') || normalized.includes('personal site')) {
    return {
      target: 'portfolio',
      confidence: 'medium'
    } as const;
  }

  if (
    normalized.includes('tell us about yourself') ||
    normalized.includes('why do you want') ||
    normalized.includes('why are you interested') ||
    normalized.includes('cover letter')
  ) {
    return {
      target: 'openQuestion',
      confidence: 'medium'
    } as const;
  }

  if (normalized.includes('summary') || normalized.includes('about you') || normalized.includes('profile')) {
    return {
      target: 'profileSummary',
      confidence: 'medium'
    } as const;
  }

  return {
    target: 'unknown',
    confidence: 'low'
  } as const;
}
