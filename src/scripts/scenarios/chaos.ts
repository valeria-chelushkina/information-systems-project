import { randomUUID } from 'node:crypto';
import { httpCall } from '@/shared/load/http.js';
import {
  runPaced,
  type Attempt,
  type ScenarioContext,
  type ScenarioResult,
} from '@/scripts/scenarios/context.js';

interface ChaosAction {
  label: string;
  expected: number;
  run: () => Promise<{ status: number; ms: number }>;
}

export async function chaos(ctx: ScenarioContext): Promise<ScenarioResult> {
  const { options, token } = ctx;

  const actions: ChaosAction[] = [
    {
      label: 'bad_password',
      expected: 401,
      run: () =>
        httpCall(configAuthUrl(), 'POST', '/auth/login', {
          body: { email: 'customer@example.com', password: 'wrong-password' },
        }),
    },
    {
      label: 'missing_token',
      expected: 401,
      run: () => httpCall(options.ticketingUrl, 'GET', '/api/events'),
    },
    {
      label: 'invalid_token',
      expected: 401,
      run: () =>
        httpCall(options.ticketingUrl, 'GET', '/api/events', { token: 'a'.repeat(64) }),
    },
    {
      label: 'unknown_event',
      expected: 404,
      run: () =>
        httpCall(options.ticketingUrl, 'GET', `/api/events/${randomUUID()}`, { token }),
    },
    {
      label: 'invalid_body',
      expected: 400,
      run: () => httpCall(options.ticketingUrl, 'POST', '/api/events', { token, body: {} }),
    },
  ];

  const attempts: Attempt[] = await runPaced(
    options.rate,
    options.duration,
    async () => {
      const action = actions[Math.floor(Math.random() * actions.length)] as ChaosAction;
      const response = await action.run();

      return {
        outcome: response.status === action.expected ? 'expected' : `unexpected_${response.status}`,
        ms: response.ms,
      };
    },
  );

  return {
    attempts,
    notes: [`actions: ${actions.map((action) => action.label).join(', ')}`],
    pass: attempts.every((attempt) => attempt.outcome === 'expected'),
  };
}

function configAuthUrl(): string {
  return process.env.AUTH_BASE_URL ?? 'http://127.0.0.1:3005';
}
