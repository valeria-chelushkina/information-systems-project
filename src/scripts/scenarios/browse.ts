import { httpCall } from '@/shared/load/http.js';
import {
  runPaced,
  type ScenarioContext,
  type ScenarioResult,
} from '@/scripts/scenarios/context.js';

export async function browse(ctx: ScenarioContext): Promise<ScenarioResult> {
  const attempts = await runPaced(ctx.options.rate, ctx.options.duration, async () => {
    const response = await httpCall(ctx.options.ticketingUrl, 'GET', '/api/events?limit=5', {
      token: ctx.token,
    });

    return {
      outcome: response.status === 200 ? 'ok' : `http_${response.status}`,
      ms: response.ms,
    };
  });

  return {
    attempts,
    notes: [`target: ${ctx.options.ticketingUrl}/api/events`],
    pass: attempts.every((attempt) => attempt.outcome === 'ok'),
  };
}
