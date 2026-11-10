import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { annotate } from '@/shared/load/annotate.js';
import { login } from '@/scripts/scenarios/context.js';
import { mixed } from '@/scripts/scenarios/mixed.js';
import type { ScenarioOptions } from '@/scripts/scenarios/options.js';

async function waitFor(name: string, url: string, timeoutMs = 180_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });

      if (response.ok) {
        console.log(`[demo] ${name} is ready`);
        return;
      }
    } catch {
      // retry
    }

    await delay(2000);
  }

  throw new Error(`${name} did not become ready at ${url}`);
}

function run(args: string[], env: NodeJS.ProcessEnv = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, args, {
      stdio: 'inherit',
      env: { ...process.env, ...env },
    });

    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${args.join(' ')} exited with ${code}`));
      }
    });
  });
}

async function main(): Promise<void> {
  const duration = Number(process.env.DEMO_DURATION ?? '300');
  const rate = Number(process.env.DEMO_RATE ?? '3');

  console.log(`[demo] mixed simulation: ${duration}s at ${rate} purchases/s`);
  console.log('[demo] waiting for services');

  await Promise.all([
    waitFor('auth', 'http://auth:3000/health'),
    waitFor('catalog', 'http://catalog:3000/health'),
    waitFor('ticketing', 'http://ticketing:3000/health'),
    waitFor('grafana', 'http://grafana:3000/api/health'),
  ]);

  console.log('[demo] applying migrations');
  await run(['dist/shared/db/migrate.js', 'ticketing']);
  await run(['dist/shared/db/migrate.js', 'catalog']);

  console.log('[demo] seeding data');
  await run(['dist/services/auth/scripts/seed.js', '--reset'], { SERVICE_NAME: 'auth' });
  await run(['dist/services/catalog/scripts/seed.js', '--reset'], { SERVICE_NAME: 'catalog' });
  await run(
    ['dist/services/ticketing/scripts/seed.js', '--reset', '--from-catalog', '--events=100'],
    { SERVICE_NAME: 'ticketing' },
  );

  const options: ScenarioOptions = {
    name: 'mixed',
    rate,
    duration,
    quantity: 1,
    seats: 5,
    buyers: 50,
    count: 5,
    ticketingUrl: process.env.TICKETING_URL ?? 'http://ticketing:3000',
    catalogUrl: process.env.CATALOG_URL ?? 'http://catalog:3000',
    annotate: true,
  };

  const token = await login();

  await annotate('demo mixed start', ['load-test', 'mixed']);

  const started = Date.now();
  const result = await mixed({ options, token });
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);

  await annotate('demo mixed end', ['load-test', 'mixed']);

  console.log(`[demo] finished in ${elapsed}s`);
  console.log(`[demo] ${result.pass ? 'PASS' : 'FAIL'}`);

  for (const note of result.notes) {
    console.log(`[demo] ${note}`);
  }

  process.exit(result.pass ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('[demo] failed', error instanceof Error ? error.message : error);
  process.exit(1);
});
