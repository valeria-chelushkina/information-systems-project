import { HttpError } from '@/shared/errors/http-error.js';

interface PgErrorMapping {
  status: number;
  code: string;
  message: string;
}

const PG_ERRORS: Record<string, PgErrorMapping> = {
  '23505': { status: 409, code: 'conflict', message: 'Resource already exists' },
  '23503': { status: 409, code: 'conflict', message: 'Referenced resource does not exist' },
  '23514': {
    status: 400,
    code: 'constraint_violation',
    message: 'Value violates a database constraint',
  },
  '22P02': { status: 400, code: 'invalid_input', message: 'Malformed identifier or value' },
};

function findPgCode(error: unknown, depth = 0): string | undefined {
  if (depth > 5 || error === null || typeof error !== 'object') {
    return undefined;
  }

  const candidate = error as { code?: unknown; cause?: unknown };
  if (typeof candidate.code === 'string') {
    return candidate.code;
  }

  return findPgCode(candidate.cause, depth + 1);
}

export function mapDatabaseError(error: unknown): HttpError | null {
  const pgCode = findPgCode(error);
  if (!pgCode) {
    return null;
  }

  const mapping = PG_ERRORS[pgCode];
  return mapping ? new HttpError(mapping.status, mapping.code, mapping.message) : null;
}
