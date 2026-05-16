import type { AppState, FieldReview } from './app-state';

export function setFields(state: AppState, fields: FieldReview[]): AppState {
  return {
    ...state,
    fields
  };
}
