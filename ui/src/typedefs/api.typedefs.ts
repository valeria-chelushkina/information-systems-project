export interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
}
