import type { AiProvider } from '../ai/provider';

type DraftInput = {
  question: string;
  profileSummary: string;
  jobSummary: string;
};

export async function draftAnswer(provider: AiProvider, input: DraftInput) {
  return provider.complete({
    system: 'Draft a truthful, concise application answer. Never invent experience.',
    user: `Question: ${input.question}\nProfile: ${input.profileSummary}\nJob: ${input.jobSummary}`
  });
}
