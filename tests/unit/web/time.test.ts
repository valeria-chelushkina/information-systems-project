import { describe, expect, it } from 'vitest';
import { localToUtc, optionalUtc } from '@/services/web/lib/time.js';

describe('Kyiv local datetime parsing', () => {
  it('converts winter local time to UTC', () => {
    expect(localToUtc('2026-01-15T19:00')?.toISOString()).toBe('2026-01-15T17:00:00.000Z');
  });

  it('applies daylight saving time in summer', () => {
    expect(localToUtc('2026-07-15T19:00')?.toISOString()).toBe('2026-07-15T16:00:00.000Z');
  });

  it('rejects malformed or impossible values', () => {
    expect(localToUtc('2026-01-15')).toBeNull();
    expect(localToUtc('2026-13-15T19:00')).toBeNull();
    expect(localToUtc('2026-01-15T25:00')).toBeNull();
    expect(localToUtc('')).toBeNull();
  });

  it('treats empty optional values as absent', () => {
    expect(optionalUtc(undefined)).toBeNull();
    expect(optionalUtc('  ')).toBeNull();
    expect(optionalUtc('2026-01-15T19:00')?.toISOString()).toBe('2026-01-15T17:00:00.000Z');
  });
});
