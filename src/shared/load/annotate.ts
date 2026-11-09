import { optionalEnv } from '@/shared/config/env.js';

export async function annotate(text: string, tags: string[] = ['load-test']): Promise<void> {
  const baseUrl = optionalEnv('GRAFANA_URL', 'http://127.0.0.1:3007');
  const user = optionalEnv('GRAFANA_ADMIN_USER', 'admin');
  const password = optionalEnv('GRAFANA_ADMIN_PASSWORD', 'admin-password');
  const credentials = Buffer.from(`${user}:${password}`).toString('base64');

  try {
    const response = await fetch(`${baseUrl}/api/annotations`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Basic ${credentials}`,
      },
      body: JSON.stringify({ text, tags }),
      signal: AbortSignal.timeout(3000),
    });

    if (!response.ok) {
      console.warn(`annotation rejected with ${response.status}`);
    }
  } catch {
    console.warn(`could not annotate ${baseUrl}; continuing`);
  }
}
