import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { setTimeout as delay } from 'node:timers/promises';

interface PrometheusAlert {
  labels: Record<string, string>;
  state: 'pending' | 'firing';
  activeAt: string;
}

interface AlertmanagerAlert {
  labels: Record<string, string>;
  status: { state: string };
}

interface ScenarioResult {
  scenario: string;
  alert: string;
  fired: boolean;
  notified: boolean;
}

const authUrl = process.env.AUTH_BASE_URL ?? 'http://127.0.0.1:3006';
const ticketingUrl = process.env.TICKETING_URL ?? 'http://127.0.0.1:3002';
const prometheusUrl = process.env.PROMETHEUS_URL ?? 'http://127.0.0.1:9090';
const alertmanagerUrl = process.env.ALERTMANAGER_URL ?? 'http://127.0.0.1:9093';
const composeEnv = existsSync('.env') ? [] : ['--env-file', '.env.example'];

const DEFAULT_SCENARIOS = 'database,synthetic';
const scenarioArg = process.argv.find((arg) => arg.startsWith('--scenario='));
const scenarios = new Set(
  (scenarioArg ? scenarioArg.split('=')[1] : DEFAULT_SCENARIOS)?.split(',') ?? [],
);
const results: ScenarioResult[] = [];

interface SyntheticAlert {
  name: string;
  severity: string;
  summary: string;
  description: string;
}

const SYNTHETIC_ALERTS: SyntheticAlert[] = [
  {
    name: 'HighLatency',
    severity: 'warning',
    summary: 'Checkout p95 latency above 1s',
    description: 'Simulated latency spike on the checkout endpoint for the alert demo.',
  },
  {
    name: 'PostgresDeadlocks',
    severity: 'critical',
    summary: 'Postgres detected a deadlock',
    description: 'Simulated deadlock between two inventory updates for the alert demo.',
  },
  {
    name: 'RefundRateHigh',
    severity: 'warning',
    summary: 'Refund rate above 20% for the last hour',
    description: 'Simulated refund surge on the November shows for the alert demo.',
  },
  {
    name: 'RabbitmqQueueBacklog',
    severity: 'warning',
    summary: 'More than 100 notifications waiting',
    description: 'Simulated consumer lag on the notifications queue for the alert demo.',
  },
];

function compose(...args: string[]): void {
  execFileSync('docker', ['compose', ...composeEnv, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function composeLogs(service: string): string {
  try {
    return execFileSync('docker', ['compose', ...composeEnv, 'logs', '--tail', '200', service], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return '';
  }
}

async function waitForUrl(url: string, timeoutMs = 30_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(3000) });
      if (response.ok) {
        return;
      }
    } catch {
      // retry
    }

    await delay(1000);
  }

  throw new Error(`service did not become ready: ${url}`);
}

async function login(): Promise<string> {
  const response = await fetch(`${authUrl}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      email: process.env.SEED_AUTH_EMAIL ?? 'admin@example.com',
      password: process.env.SEED_AUTH_PASSWORD ?? 'admin-password',
    }),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`login failed with ${response.status}`);
  }

  const body = (await response.json()) as { data: { token: string } };
  return body.data.token;
}

async function hitEvents(token: string): Promise<number> {
  try {
    const response = await fetch(`${ticketingUrl}/api/events`, {
      headers: { authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(5000),
    });
    return response.status;
  } catch {
    return 0;
  }
}

async function wrongLogin(): Promise<number> {
  try {
    const response = await fetch(`${authUrl}/auth/login`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'nobody@example.com', password: 'wrong-password' }),
      signal: AbortSignal.timeout(3000),
    });
    return response.status;
  } catch {
    return 0;
  }
}

async function prometheusAlerts(): Promise<PrometheusAlert[]> {
  const response = await fetch(`${prometheusUrl}/api/v1/alerts`, {
    signal: AbortSignal.timeout(5000),
  });
  const body = (await response.json()) as { data: { alerts: PrometheusAlert[] } };
  return body.data.alerts;
}

async function alertmanagerAlerts(): Promise<AlertmanagerAlert[]> {
  const response = await fetch(`${alertmanagerUrl}/api/v2/alerts`, {
    signal: AbortSignal.timeout(5000),
  });
  return (await response.json()) as AlertmanagerAlert[];
}

async function waitForPrometheus(name: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const alerts = await prometheusAlerts();
    const match = alerts.find((alert) => alert.labels.alertname === name);

    if (match) {
      console.log(`[alerts] prometheus: ${name} ${match.state}`);
    }

    if (match?.state === 'firing') {
      return true;
    }

    await delay(5000);
  }

  return false;
}

async function waitForPrometheusClear(name: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const alerts = await prometheusAlerts();
    if (!alerts.some((alert) => alert.labels.alertname === name)) {
      return true;
    }

    await delay(5000);
  }

  return false;
}

function notified(kind: 'firing' | 'resolved', name: string): boolean {
  const label = kind === 'firing' ? 'alert received' : 'alert resolved';
  const logs = composeLogs('notify');

  return logs
    .split('\n')
    .some((line) => line.includes(label) && line.includes(`"alert":"${name}"`));
}

async function waitForNotify(name: string, timeoutMs = 25_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (notified('firing', name)) {
      return true;
    }

    await delay(2000);
  }

  return false;
}

function record(scenario: string, name: string, fired: boolean): void {
  const result = {
    scenario,
    alert: name,
    fired,
    notified: fired && notified('firing', name),
  };

  results.push(result);
  console.log(
    `[alerts] ${name}: ${fired ? 'fired' : 'did not fire'}${
      result.notified ? ', webhook received' : ''
    }`,
  );
}

async function recordAlert(
  scenario: string,
  name: string,
  fired: boolean,
): Promise<void> {
  const seen = fired && (await waitForNotify(name));
  const result = { scenario, alert: name, fired, notified: seen };

  results.push(result);
  console.log(
    `[alerts] ${name}: ${fired ? 'fired' : 'did not fire'}${
      seen ? ', webhook received' : ''
    }`,
  );
}

async function runDatabase(token: string): Promise<void> {
  console.log('[alerts] scenario database: stopping postgres');
  compose('stop', 'postgres');

  try {
    await delay(3000);

    console.log('[alerts] scenario database: generating 5xx responses');
    for (let index = 0; index < 3; index += 1) {
      console.log(`[alerts] request ${index + 1}: ${await hitEvents(token)}`);
    }

    await delay(12_000);

    for (let index = 0; index < 2; index += 1) {
      console.log(`[alerts] request ${index + 1}: ${await hitEvents(token)}`);
    }

    await recordAlert('database', 'ServiceError', await waitForPrometheus('ServiceError', 90_000));
    await recordAlert('database', 'PostgresDown', await waitForPrometheus('PostgresDown', 120_000));
  } finally {
    console.log('[alerts] scenario database: restarting postgres');
    compose('start', 'postgres');
  }

  await waitForUrl(`${ticketingUrl}/health`, 60_000);
  record('database', 'ServiceError cleared', await waitForPrometheusClear('ServiceError', 120_000));
}

async function runBroker(): Promise<void> {
  console.log('[alerts] scenario broker: stopping rabbitmq');
  compose('stop', 'rabbitmq');

  try {
    await recordAlert('broker', 'RabbitmqDown', await waitForPrometheus('RabbitmqDown', 3 * 60_000));
  } finally {
    console.log('[alerts] scenario broker: restarting rabbitmq');
    compose('start', 'rabbitmq');
  }

  await waitForUrl(`${prometheusUrl}/-/ready`, 30_000);
  record('broker', 'RabbitmqDown cleared', await waitForPrometheusClear('RabbitmqDown', 3 * 60_000));
}

async function runAuth(): Promise<void> {
  console.log('[alerts] scenario auth: sending failed logins for five minutes');
  const deadline = Date.now() + 5 * 60_000 + 30_000;

  while (Date.now() < deadline) {
    await Promise.all([wrongLogin(), wrongLogin(), wrongLogin()]);
    await delay(500);
  }

  await recordAlert('auth', 'AuthFailureSpike', await waitForPrometheus('AuthFailureSpike', 8 * 60_000));
}

async function inject(alert: SyntheticAlert): Promise<void> {
  const response = await fetch(`${alertmanagerUrl}/api/v2/alerts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify([
      {
        labels: {
          alertname: alert.name,
          severity: alert.severity,
          instance: 'demo',
        },
        annotations: {
          summary: alert.summary,
          description: alert.description,
        },
        startsAt: new Date().toISOString(),
      },
    ]),
    signal: AbortSignal.timeout(5000),
  });

  if (!response.ok) {
    throw new Error(`alertmanager rejected ${alert.name}: ${response.status}`);
  }
}

async function resolve(alert: SyntheticAlert): Promise<void> {
  await fetch(`${alertmanagerUrl}/api/v2/alerts`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify([
      {
        labels: { alertname: alert.name, severity: alert.severity, instance: 'demo' },
        annotations: { summary: alert.summary },
        startsAt: new Date(Date.now() - 60_000).toISOString(),
        endsAt: new Date().toISOString(),
      },
    ]),
    signal: AbortSignal.timeout(5000),
  });
}

async function waitForAlertmanager(name: string, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const alerts = await alertmanagerAlerts();
    if (alerts.some((alert) => alert.labels.alertname === name)) {
      return true;
    }

    await delay(2000);
  }

  return false;
}

async function runSynthetic(): Promise<void> {
  console.log('[alerts] scenario synthetic: injecting demo alerts with different reasons');

  for (const alert of SYNTHETIC_ALERTS) {
    await inject(alert);
    const active = await waitForAlertmanager(alert.name, 30_000);
    const seen = active && (await waitForNotify(alert.name));
    results.push({
      scenario: 'synthetic',
      alert: alert.name,
      fired: active,
      notified: seen,
    });
    console.log(
      `[alerts] ${alert.name}: ${active ? 'fired' : 'missing'}${
        seen ? ', webhook received' : ''
      }`,
    );
  }

  console.log('[alerts] scenario synthetic: resolving demo alerts');
  await delay(10_000);

  for (const alert of SYNTHETIC_ALERTS) {
    await resolve(alert);
    console.log(
      `[alerts] ${alert.name} resolved: email follows on the next group interval`,
    );
  }
}

async function main(): Promise<void> {
  console.log(`[alerts] scenarios: ${[...scenarios].join(', ')}`);
  console.log('[alerts] checking the stack');
  await Promise.all([
    waitForUrl(`${authUrl}/health`),
    waitForUrl(`${ticketingUrl}/health`),
    waitForUrl(`${prometheusUrl}/-/ready`),
    waitForUrl(`${alertmanagerUrl}/-/ready`),
  ]);

  const token = await login();
  console.log('[alerts] authenticated');

  if (scenarios.has('database')) {
    await runDatabase(token);
  }

  if (scenarios.has('broker')) {
    await runBroker();
  }

  if (scenarios.has('auth')) {
    await runAuth();
  }

  if (scenarios.has('synthetic')) {
    await runSynthetic();
  }

  console.log('[alerts] summary');
  for (const result of results) {
    console.log(
      `[alerts] ${result.scenario.padEnd(10)} ${result.alert.padEnd(28)} ${
        result.fired ? 'ok' : 'missing'
      }${result.notified ? ', notified' : ''}`,
    );
  }

  console.log('[alerts] open http://localhost:9090/alerts');
  console.log('[alerts] open http://localhost:9093');
  console.log(
    scenarios.has('synthetic')
      ? '[alerts] check your inbox for the synthetic and real alerts'
      : '[alerts] check your inbox for the fired alerts',
  );

  const failed = results.filter((result) => !result.fired);

  process.exit(failed.length === 0 ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('[alerts] failed', error instanceof Error ? error.message : error);
  process.exit(1);
});
