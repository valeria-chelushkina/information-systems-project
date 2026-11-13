import { describe, expect, it } from 'vitest';
import { formatAlertEmail } from '@/services/notify/modules/alerts/alerts.email.js';
import type { Alert } from '@/services/notify/modules/alerts/alerts.typedefs.js';

const firing: Alert = {
  status: 'firing',
  labels: {
    alertname: 'ServiceDown',
    severity: 'critical',
    instance: 'ticketing:3000',
  },
  annotations: { summary: 'Ticketing is not responding' },
  startsAt: '2026-11-13T19:00:00Z',
};

const resolved: Alert = {
  status: 'resolved',
  labels: {
    alertname: 'ServiceDown',
    severity: 'critical',
    instance: 'ticketing:3000',
  },
  annotations: { summary: 'Ticketing is not responding' },
  startsAt: '2026-11-13T19:00:00Z',
  endsAt: '2026-11-13T19:05:00Z',
};

describe('alert email formatting', () => {
  it('builds a firing notification with alert details and links', () => {
    const email = formatAlertEmail(
      [firing],
      'http://localhost:3008',
      'http://localhost:3007',
    );

    expect(email.subject).toBe('[Concert Ops] FIRING: ServiceDown');
    expect(email.text).toContain('Alerts: 1 firing, 0 resolved');
    expect(email.text).toContain('ServiceDown (critical) - firing');
    expect(email.text).toContain('Instance: ticketing:3000');
    expect(email.text).toContain('Summary: Ticketing is not responding');
    expect(email.text).toContain('Admin panel: http://localhost:3008');
    expect(email.text).toContain('Grafana: http://localhost:3007');
  });

  it('marks a batch of resolved alerts as resolved', () => {
    const email = formatAlertEmail(
      [resolved],
      'http://localhost:3008',
      'http://localhost:3007',
    );

    expect(email.subject).toBe('[Concert Ops] RESOLVED: ServiceDown');
    expect(email.text).toContain('Alerts: 0 firing, 1 resolved');
    expect(email.text).toContain('Ended: 2026-11-13T19:05:00Z');
  });

  it('summarises several alert names in the subject', () => {
    const email = formatAlertEmail(
      [firing, resolved, { ...firing, labels: { ...firing.labels, alertname: 'PostgresDown' } }],
      'http://localhost:3008',
      'http://localhost:3007',
    );

    expect(email.subject).toBe('[Concert Ops] FIRING: ServiceDown, PostgresDown');
  });
});
