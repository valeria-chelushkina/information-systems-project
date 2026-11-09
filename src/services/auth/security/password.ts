import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;
const ALGORITHM = 'scrypt';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derived = scryptSync(password, salt, KEY_LENGTH).toString('hex');
  return `${ALGORITHM}$${salt}$${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [algorithm, salt, expected] = stored.split('$');

  if (algorithm !== ALGORITHM || !salt || !expected) {
    return false;
  }

  const derived = scryptSync(password, salt, KEY_LENGTH);
  const expectedBuffer = Buffer.from(expected, 'hex');

  if (derived.length !== expectedBuffer.length) {
    return false;
  }

  return timingSafeEqual(derived, expectedBuffer);
}
