import type { FieldDescriptor } from '../forms/semantic-map';
import type { AiProvider } from './provider';

export type SmartFillSuggestion = {
  id: string;
  label: string;
  value?: string;
  status: 'autofilled' | 'needs-confirmation' | 'unmatched';
  reason?: string;
};

export type SmartFillPlan = {
  suggestions: SmartFillSuggestion[];
};

type SmartFillInput = {
  fields: FieldDescriptor[];
  resumeText: string;
  jobDescription: string;
};

function trimText(text: string, limit: number) {
  return text.replace(/\s+/g, ' ').trim().slice(0, limit);
}

function extractJson(text: string) {
  const fencedMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }

  return text;
}

function normalizeStatus(status: string | undefined): SmartFillSuggestion['status'] {
  if (status === 'autofilled' || status === 'needs-confirmation' || status === 'unmatched') {
    return status;
  }

  return 'unmatched';
}

export async function planSmartFill(provider: AiProvider, input: SmartFillInput): Promise<SmartFillPlan> {
  const result = await provider.complete({
    system:
      'You help fill job application forms. Return strict JSON only. Never invent qualifications or facts. Use "autofilled" only for high-confidence truthful values, "needs-confirmation" when wording is subjective or inferred, and "unmatched" when the resume/JD does not support an answer.',
    user: JSON.stringify(
      {
        task: 'Create field-level fill suggestions for a browser extension.',
        constraints: [
          'Return a JSON object with one key: suggestions.',
          'suggestions must be an array of { id, label, value, status, reason }.',
          'Keep value empty for unmatched fields.',
          'Prefer concise answers that can be inserted directly into inputs or textareas.',
          'For open questions, ground the answer in the resume and JD without fabricating experience.'
        ],
        resumeText: trimText(input.resumeText, 5000),
        jobDescription: trimText(input.jobDescription, 5000),
        fields: input.fields
      },
      null,
      2
    )
  });

  const parsed = JSON.parse(extractJson(result)) as {
    suggestions?: Array<{
      id?: string;
      label?: string;
      value?: string;
      status?: string;
      reason?: string;
    }>;
  };

  return {
    suggestions: (parsed.suggestions ?? [])
      .filter((suggestion): suggestion is NonNullable<typeof suggestion> => !!suggestion?.id && !!suggestion?.label)
      .map((suggestion) => ({
        id: suggestion.id ?? '',
        label: suggestion.label ?? '',
        value: suggestion.value?.trim() ?? '',
        status: normalizeStatus(suggestion.status),
        reason: suggestion.reason?.trim()
      }))
  };
}
