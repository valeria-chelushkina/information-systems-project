import { webConfig } from '@/services/web/config.js';

function timeZoneOffsetMs(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(date);

  const values: Record<string, number> = {};

  for (const part of parts) {
    if (part.type !== 'literal') {
      values[part.type] = Number(part.value);
    }
  }

  const asUtc = Date.UTC(
    values.year ?? 0,
    (values.month ?? 1) - 1,
    values.day ?? 1,
    (values.hour ?? 0) % 24,
    values.minute ?? 0,
    values.second ?? 0,
  );

  return asUtc - date.getTime();
}

export function localToUtc(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);

  if (month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59) {
    return null;
  }

  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const firstPass = guess - timeZoneOffsetMs(new Date(guess), webConfig.timeZone);
  const secondPass = guess - timeZoneOffsetMs(new Date(firstPass), webConfig.timeZone);
  const result = new Date(secondPass);

  return Number.isNaN(result.getTime()) ? null : result;
}

export function optionalUtc(value: string | undefined): Date | null {
  if (value === undefined || value.trim() === '') {
    return null;
  }

  return localToUtc(value);
}

export function startOfKyivDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  return localToUtc(`${value}T00:00`);
}

export function endOfKyivDay(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }

  const [year, month, day] = value.split('-').map(Number);
  const next = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, (day ?? 1) + 1));
  const nextValue = next.toISOString().slice(0, 10);
  const start = localToUtc(`${nextValue}T00:00`);

  return start ? new Date(start.getTime() - 1) : null;
}
