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

const authUrl = process.env.AUTH_BASE_URL ?? 'http://127.0.0.1:3006';
const ticketingUrl = process.env.TICKETING_URL ?? 'http://127.0.0.1:3002';
const prometheusUrl = process.env.PROMETHEUS_URL ?? 'http://127.0.0.1:9090';
const alertmanagerUrl = process.env.ALERTMANAGER_URL ?? 'http://127.0.0.1:9093';
const composeEnv = existsSync('.env') ? [] : ['--env-file', '.env.example'];

function compose(...args: string[]): void {
  execFileSync('docker', ['compose', ...composeEnv, ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function composeLogs(service: string): string {
  try {
    return execFileSync('docker', ['compose', ...composeEnv, 'logs', '--tail', '80', service], {
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

function printPrometheus(alerts: PrometheusAlert[]): void {
  for (const alert of alerts.filter((item) => item.labels.alertname === 'ServiceError' || item.labels.alertname === 'PostgresDown')) {
    console.log(`[alerts] prometheus: ${alert.labels.alertname} ${alert.state}`);
  }
}

function printAlertmanager(alerts: AlertmanagerAlert[]): void {
  for (const alert of alerts.filter((item) => item.labels.alertname === 'ServiceError' || item.labels.alertname === 'PostgresDown')) {
    console.log(`[alerts] alertmanager: ${alert.labels.alertname} ${alert.status.state}`);
  }
}

async function waitForFiring(name: string, timeoutMs = 60_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const alerts = await prometheusAlerts();
    printPrometheus(alerts);

    if (alerts.some((alert) => alert.labels.alertname === name && alert.state === 'firing')) {
      return true;
    }

    await delay(5000);
  }

  return false;
}

async function waitForClear(name: string, timeoutMs = 120_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const alerts = await prometheusAlerts();
    const stillActive = alerts.some((alert) => alert.labels.alertname === name);

    if (!stillActive) {
      return true;
    }

    await delay(5000);
  }

  return false;
}

async function main(): Promise<void> {
  console.log('[alerts] checking the stack');
  await Promise.all([
    waitForUrl(`${authUrl}/health`),
    waitForUrl(`${ticketingUrl}/health`),
    waitForUrl(`${prometheusUrl}/-/ready`),
    waitForUrl(`${alertmanagerUrl}/-/ready`),
  ]);

  const token = await login();
  console.log('[alerts] authenticated');

  console.log('[alerts] stopping postgres for a controlled outage');
  compose('stop', 'postgres');

  try {
    await delay(3000);

    console.log('[alerts] generating 5xx responses');
    for (let index = 0; index < 3; index += 1) {
      const status = await hitEvents(token);
      console.log(`[alerts] request ${index + 1}: ${status}`);
    }

    await delay(12_000);

    for (let index = 0; index < 2; index += 1) {
      const status = await hitEvents(token);
      console.log(`[alerts] request ${index + 1}: ${status}`);
    }

    console.log('[alerts] waiting for ServiceError');
    const fired = await waitForFiring('ServiceError');

    printAlertmanager(await alertmanagerAlerts());

    const notifyLog = composeLogs('notify');
    const received = notifyLog
      .split('\n')
      .filter((line) => line.includes('alert received') && line.includes('ServiceError'))
      .slice(-1)
      .join('');

    if (received) {
      console.log(`[alerts] notify: ${received.trim()}`);
    }

    if (!fired) {
      throw new Error('ServiceError did not fire');
    }
  } finally {
    console.log('[alerts] restarting postgres');
    compose('start', 'postgres');
  }

  await waitForUrl(`${ticketingUrl}/health`, 60_000);

  console.log('[alerts] waiting for resolution');
  const cleared = await waitForClear('ServiceError');
  await delay(5000);

  const resolvedLog = composeLogs('notify');
  const resolved = resolvedLog
    .split('\n')
    .filter((line) => line.includes('alert resolved') && line.includes('ServiceError'))
    .slice(-1)
    .join('');

  if (resolved) {
    console.log(`[alerts] notify: ${resolved.trim()}`);
  }

  console.log('[alerts] open http://localhost:9090/alerts');
  console.log('[alerts] open http://localhost:9093');
  console.log(cleared ? '[alerts] PASS' : '[alerts] WARN: alert did not clear in time');
  process.exit(cleared ? 0 : 1);
}

main().catch((error: unknown) => {
  console.error('[alerts] failed', error instanceof Error ? error.message : error);
  process.exit(1);
});
