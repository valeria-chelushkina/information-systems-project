import type { Request } from 'express';

export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie;

  if (!header) {
    return undefined;
  }

  for (const part of header.split(';')) {
    const index = part.indexOf('=');

    if (index === -1) {
      continue;
    }

    const key = part.slice(0, index).trim();

    if (key === name) {
      return decodeURIComponent(part.slice(index + 1).trim());
    }
  }

  return undefined;
}

export interface CookieOptions {
  maxAgeSeconds: number;
  secure: boolean;
}

function attributes(secure: boolean, maxAgeSeconds: number): string[] {
  const parts = ['Path=/', 'HttpOnly', 'SameSite=Lax', `Max-Age=${maxAgeSeconds}`];

  if (secure) {
    parts.push('Secure');
  }

  return parts;
}

export function sessionCookie(name: string, token: string, options: CookieOptions): string {
  return [`${name}=${encodeURIComponent(token)}`, ...attributes(options.secure, options.maxAgeSeconds)].join(
    '; ',
  );
}

export function clearCookie(name: string, secure: boolean): string {
  return [`${name}=`, ...attributes(secure, 0)].join('; ');
}
