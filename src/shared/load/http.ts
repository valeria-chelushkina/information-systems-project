export interface HttpResult {
  status: number;
  body: unknown;
  ms: number;
  error?: string;
}

export interface HttpOptions {
  body?: unknown;
  token?: string;
  headers?: Record<string, string>;
}

export async function httpCall(
  baseUrl: string,
  method: string,
  path: string,
  options: HttpOptions = {},
): Promise<HttpResult> {
  const started = performance.now();

  try {
    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(options.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
        ...(options.headers ?? {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });

    const text = await response.text();
    let body: unknown = null;

    if (text) {
      try {
        body = JSON.parse(text);
      } catch {
        body = text;
      }
    }

    return { status: response.status, body, ms: Math.round(performance.now() - started) };
  } catch (error) {
    return {
      status: 0,
      body: null,
      ms: Math.round(performance.now() - started),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
