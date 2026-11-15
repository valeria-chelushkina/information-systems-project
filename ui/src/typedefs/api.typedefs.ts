export interface ErrorEnvelope {
  error?: { code?: string; message?: string; details?: unknown };
}

export interface ApiRequestOptions {
  method?: string;
  body?: unknown;
}
