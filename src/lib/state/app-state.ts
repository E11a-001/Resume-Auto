export type FieldReview = {
  label: string;
  status: 'autofilled' | 'needs-confirmation' | 'unmatched';
  value?: string;
};

export type AppState = {
  fields: FieldReview[];
};

export const initialAppState: AppState = {
  fields: []
};
