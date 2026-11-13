import { webConfig } from '@/services/web/config.js';

export class UpstreamError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'UpstreamError';
    this.status = status;
    this.code = code;
  }
}

interface DataEnvelope<T> {
  data: T;
}

interface PageEnvelope<T> {
  data: T[];
  meta: { total: number; limit: number; offset: number };
}

interface ErrorEnvelope {
  error?: { code?: string; message?: string };
}

export interface CallOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  token?: string;
  body?: unknown;
  query?: Record<string, string | number | undefined>;
}

export interface Page<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}

function buildUrl(baseUrl: string, path: string, query?: CallOptions['query']): URL {
  const url = new URL(path, baseUrl);

  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }
  }

  return url;
}

async function send(
  baseUrl: string,
  path: string,
  options: CallOptions,
): Promise<Response> {
  try {
    return await fetch(buildUrl(baseUrl, path, options.query), {
      method: options.method ?? 'GET',
      headers: {
        accept: 'application/json',
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: AbortSignal.timeout(webConfig.timeoutMs),
    });
  } catch {
    throw new UpstreamError(503, 'upstream_unavailable', `${baseUrl} is unavailable`);
  }
}

async function parse(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text.length === 0) {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

async function unwrap<T>(baseUrl: string, path: string, options: CallOptions): Promise<T> {
  const response = await send(baseUrl, path, options);
  const payload = await parse(response);

  if (!response.ok) {
    const error = (payload as ErrorEnvelope | null)?.error;
    throw new UpstreamError(
      response.status,
      error?.code ?? 'upstream_error',
      error?.message ?? `${baseUrl}${path} responded with ${response.status}`,
    );
  }

  return (payload as DataEnvelope<T>).data;
}

export function call<T>(baseUrl: string, path: string, options: CallOptions = {}): Promise<T> {
  return unwrap<T>(baseUrl, path, options);
}

export async function callPage<T>(
  baseUrl: string,
  path: string,
  options: CallOptions = {},
): Promise<Page<T>> {
  const response = await send(baseUrl, path, options);
  const payload = await parse(response);

  if (!response.ok) {
    const error = (payload as ErrorEnvelope | null)?.error;
    throw new UpstreamError(
      response.status,
      error?.code ?? 'upstream_error',
      error?.message ?? `${baseUrl}${path} responded with ${response.status}`,
    );
  }

  const page = payload as PageEnvelope<T>;

  return {
    items: page.data,
    total: page.meta.total,
    limit: page.meta.limit,
    offset: page.meta.offset,
  };
}

export async function callEmpty(
  baseUrl: string,
  path: string,
  options: CallOptions = {},
): Promise<void> {
  const response = await send(baseUrl, path, options);

  if (!response.ok) {
    const payload = await parse(response);
    const error = (payload as ErrorEnvelope | null)?.error;
    throw new UpstreamError(
      response.status,
      error?.code ?? 'upstream_error',
      error?.message ?? `${baseUrl}${path} responded with ${response.status}`,
    );
  }
}

export async function probe(baseUrl: string, timeoutMs = 1500): Promise<boolean> {
  try {
    const response = await fetch(new URL('/health', baseUrl), {
      signal: AbortSignal.timeout(timeoutMs),
    });

    return response.ok;
  } catch {
    return false;
  }
}
