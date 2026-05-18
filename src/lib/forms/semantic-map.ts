export type FieldDescriptor = {
  id?: string;
  label: string;
  sectionHeading?: string;
  tagName?: 'input' | 'textarea' | 'select';
  inputType?: string;
  placeholder?: string;
  options?: string[];
};

export function mapFieldToProfileKey(field: FieldDescriptor) {
  const normalized = `${field.sectionHeading ?? ''} ${field.label}`.toLowerCase();
  const hasStandaloneName = /\bname\b/.test(normalized) && !normalized.includes('company name');
  const isInternshipContext = normalized.includes('internship') || normalized.includes('实习');
  const isProjectContext = normalized.includes('project') || normalized.includes('项目');
  const isWorkContext =
    normalized.includes('work experience') ||
    normalized.includes('employment') ||
    normalized.includes('professional experience') ||
    normalized.includes('工作经历') ||
    normalized.includes('职业经历');
  const isDescriptionLabel =
    normalized.includes('description') ||
    normalized.includes('responsibilities') ||
    normalized.includes('summary') ||
    normalized.includes('result') ||
    normalized.includes('内容') ||
    normalized.includes('描述') ||
    normalized.includes('职责') ||
    normalized.includes('成果');

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

  if (
    (isInternshipContext && isDescriptionLabel) ||
    normalized.includes('internship content') ||
    normalized.includes('internship description')
  ) {
    return {
      target: 'experienceDescription',
      experienceTypes: ['internship'],
      confidence: 'high'
    } as const;
  }

  if (
    normalized.includes('company name') ||
    normalized.includes('employer') ||
    normalized.includes('organization') ||
    normalized.includes('单位名称') ||
    normalized.includes('公司名称')
  ) {
    return {
      target: 'companyName',
      experienceTypes: isInternshipContext ? ['internship'] : ['full_time', 'internship'],
      confidence: 'high'
    } as const;
  }

  if (
    normalized.includes('job title') ||
    normalized.includes('role title') ||
    normalized.includes('position title') ||
    normalized.includes('职位名称') ||
    normalized.includes('岗位名称')
  ) {
    return {
      target: 'jobTitle',
      experienceTypes: isInternshipContext ? ['internship'] : ['full_time', 'internship'],
      confidence: 'high'
    } as const;
  }

  if (normalized.includes('project name') || normalized.includes('项目名称')) {
    return {
      target: 'projectName',
      confidence: 'high'
    } as const;
  }

  if (isInternshipContext && !isDescriptionLabel) {
    return {
      target: 'experiences',
      experienceTypes: ['internship'],
      confidence: 'high'
    } as const;
  }

  if (isWorkContext && !isDescriptionLabel) {
    return {
      target: 'experiences',
      experienceTypes: ['full_time', 'internship'],
      confidence: 'medium'
    } as const;
  }

  if (
    (isProjectContext && isDescriptionLabel) ||
    normalized.includes('project description') ||
    normalized.includes('project summary') ||
    normalized.includes('project result')
  ) {
    return {
      target: 'projectDescription',
      confidence: 'high'
    } as const;
  }

  if (
    (isWorkContext && isDescriptionLabel) ||
    normalized.includes('job description') ||
    normalized.includes('role description') ||
    normalized.includes('工作内容') ||
    normalized.includes('职责描述') ||
    normalized.includes('工作描述') ||
    normalized.includes('岗位职责') ||
    normalized.includes('工作成果')
  ) {
    return {
      target: 'experienceDescription',
      experienceTypes: ['full_time', 'internship'],
      confidence: 'high'
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
