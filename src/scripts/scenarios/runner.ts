import { annotate } from '@/shared/load/annotate.js';
import { browse } from '@/scripts/scenarios/browse.js';
import { chaos } from '@/scripts/scenarios/chaos.js';
import { login, type ScenarioContext, type ScenarioResult } from '@/scripts/scenarios/context.js';
import { parseOptions, type ScenarioOptions } from '@/scripts/scenarios/options.js';
import { purchase } from '@/scripts/scenarios/purchase.js';
import { refund } from '@/scripts/scenarios/refund.js';
import { surge } from '@/scripts/scenarios/surge.js';

type Scenario = (ctx: ScenarioContext) => Promise<ScenarioResult>;

const SCENARIOS: Record<string, Scenario> = {
  browse,
  purchase,
  surge,
  chaos,
  refund,
};

function percentile(values: number[], p: number): number {
  if (values.length === 0) {
    return 0;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const index = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[index] ?? 0;
}

function summarize(options: ScenarioOptions, result: ScenarioResult): void {
  const counts = new Map<string, number>();

  for (const attempt of result.attempts) {
    counts.set(attempt.outcome, (counts.get(attempt.outcome) ?? 0) + 1);
  }

  const latencies = result.attempts.map((attempt) => attempt.ms);

  console.log(`\nscenario: ${options.name}`);
  console.log(`attempts: ${result.attempts.length}`);

  for (const [outcome, count] of [...counts.entries()].sort((left, right) => right[1] - left[1])) {
    console.log(`  ${outcome}: ${count}`);
  }

  console.log(
    `p50: ${percentile(latencies, 50)} ms   p95: ${percentile(latencies, 95)} ms   max: ${Math.max(0, ...latencies)} ms`,
  );

  for (const note of result.notes) {
    console.log(`note: ${note}`);
  }

  console.log(result.pass ? '\nPASS' : '\nFAIL');
}

async function main(): Promise<void> {
  const options = parseOptions(process.argv.slice(2));
  const scenario = SCENARIOS[options.name];

  if (!scenario) {
    throw new Error(
      `Unknown scenario "${options.name}". Expected one of: ${Object.keys(SCENARIOS).join(', ')}`,
    );
  }

  const token = await login();

  if (options.annotate) {
    await annotate(`scenario ${options.name} start`, ['load-test', options.name]);
  }

  const startedAt = Date.now();
  const result = await scenario({ options, token });
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);

  if (options.annotate) {
    await annotate(`scenario ${options.name} end`, ['load-test', options.name]);
  }

  console.log(`wall clock: ${elapsed} s`);
  summarize(options, result);

  process.exit(result.pass ? 0 : 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
