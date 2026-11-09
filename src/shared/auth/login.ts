interface LoginEnvelope {
  data: { token: string };
}

export async function fetchAccessToken(
  authBaseUrl: string,
  email: string,
  password: string,
  timeoutMs = 5000,
): Promise<string> {
  let response: Response;

  try {
    response = await fetch(`${authBaseUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email, password }),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Cannot reach auth at ${authBaseUrl} (${message})`);
  }

  if (!response.ok) {
    throw new Error(`auth login for ${email} failed with ${response.status}`);
  }

  const body = (await response.json()) as LoginEnvelope;
  return body.data.token;
}
