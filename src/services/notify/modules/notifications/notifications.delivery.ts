export type DeliveryStep = 'retry' | 'dead';

export function attemptsFromHeader(value: unknown): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) && parsed >= 1 ? Math.floor(parsed) : 1;
}

export function nextStep(attempts: number, maxAttempts: number): DeliveryStep {
  return attempts >= maxAttempts ? 'dead' : 'retry';
}

export function errorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
