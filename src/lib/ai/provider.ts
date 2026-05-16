export type CompletionRequest = {
  system: string;
  user: string;
};

export interface AiProvider {
  complete(request: CompletionRequest): Promise<string>;
}
