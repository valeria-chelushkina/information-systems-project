import type { ZodError, ZodType } from 'zod';
import { HttpError } from '@/shared/errors/http-error.js';

interface ValidationIssue {
  path: string;
  message: string;
}

function formatIssues(error: ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}

export function validate<T>(schema: ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) {
    throw HttpError.badRequest(
      'validation_failed',
      'Request validation failed',
      formatIssues(result.error),
    );
  }

  return result.data;
}
