import type { JobContext } from '../schema/job-context';
import type { Profile } from '../schema/profile';

export function buildTailoredResumeVersion(profile: Profile, job: JobContext) {
  return {
    id: crypto.randomUUID(),
    name: `${job.company} - ${job.roleTitle} - v1`,
    sourceProfileId: 'master-profile',
    createdAt: new Date().toISOString(),
    jobContext: job,
    profile: structuredClone(profile)
  };
}
