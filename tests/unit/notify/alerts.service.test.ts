import { afterEach, describe, expect, it, vi } from 'vitest';
import { AlertMailer } from '@/services/notify/modules/alerts/alerts.email.js';
import { AlertsService } from '@/services/notify/modules/alerts/alerts.service.js';
import type { Alert } from '@/services/notify/modules/alerts/alerts.typedefs.js';

const alert: Alert = {
  status: 'firing',
  labels: { alertname: 'ServiceDown', severity: 'critical' },
  annotations: { summary: 'Ticketing is not responding' },
};

function enableMailer(): void {
  vi.spyOn(AlertMailer.prototype, 'enabled', 'get').mockReturnValue(true);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('alerts service email delivery', () => {
  it('sends one email per webhook and resolves', async () => {
    enableMailer();
    const send = vi.spyOn(AlertMailer.prototype, 'send').mockResolvedValue({
      messageId: '<test@example.com>',
      accepted: ['ops@test.local'],
      rejected: [],
      response: '250 2.0.0 Ok: queued as ABC123',
    });

    const service = new AlertsService();
    await service.handle([alert]);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('does not fail the webhook when SMTP errors and pauses further attempts', async () => {
    enableMailer();
    const send = vi
      .spyOn(AlertMailer.prototype, 'send')
      .mockRejectedValue(Object.assign(new Error('Invalid login'), { code: 'EAUTH' }));

    const service = new AlertsService();
    await expect(service.handle([alert])).resolves.toBeUndefined();
    await service.handle([alert]);

    expect(send).toHaveBeenCalledTimes(1);
  });

  it('retries once the pause has expired', async () => {
    enableMailer();
    const send = vi.spyOn(AlertMailer.prototype, 'send');
    send.mockRejectedValueOnce(new Error('socket hang up'));
    send.mockResolvedValue({
      messageId: '<test@example.com>',
      accepted: ['ops@test.local'],
      rejected: [],
      response: '250 2.0.0 Ok: queued as ABC123',
    });

    const service = new AlertsService();
    await service.handle([alert]);
    expect(send).toHaveBeenCalledTimes(1);

    const now = Date.now();
    vi.spyOn(Date, 'now').mockReturnValue(now + 16 * 60_000);
    await service.handle([alert]);

    expect(send).toHaveBeenCalledTimes(2);
  });
});
