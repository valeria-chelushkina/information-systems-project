import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '@/services/auth/security/password.js';
import { createToken, hashToken } from '@/services/auth/security/token.js';

describe('password hashing', () => {
  it('stores a salted scrypt hash and verifies the password', () => {
    const hash = hashPassword('correct-horse');

    expect(hash).toMatch(/^scrypt\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
    expect(hash).not.toContain('correct-horse');
    expect(verifyPassword('correct-horse', hash)).toBe(true);
    expect(verifyPassword('wrong-horse', hash)).toBe(false);
  });

  it('produces a different hash for the same password', () => {
    expect(hashPassword('same-password')).not.toBe(hashPassword('same-password'));
  });

  it('rejects malformed stored hashes', () => {
    expect(verifyPassword('password', 'plain-text')).toBe(false);
    expect(verifyPassword('password', 'scrypt$salt')).toBe(false);
  });
});

describe('session tokens', () => {
  it('creates 256-bit opaque tokens', () => {
    const first = createToken();
    const second = createToken();

    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(second).not.toBe(first);
  });

  it('hashes tokens deterministically without storing the raw value', () => {
    const token = createToken();
    const hash = hashToken(token);

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(hash).not.toBe(token);
    expect(hashToken(token)).toBe(hash);
  });
});
