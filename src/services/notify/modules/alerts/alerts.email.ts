import nodemailer, { type Transporter } from 'nodemailer';
import { notifyConfig } from '@/services/notify/config.js';
import type { Alert } from '@/services/notify/modules/alerts/alerts.typedefs.js';

export interface AlertEmail {
  subject: string;
  text: string;
}

export interface AlertEmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  response: string;
}

function alertLine(alert: Alert, index: number): string {
  const name = alert.labels.alertname ?? 'UnknownAlert';
  const severity = alert.labels.severity ?? 'unknown';
  const instance = alert.labels.instance ?? alert.labels.job ?? 'unknown';
  const summary = alert.annotations.summary ?? alert.annotations.description ?? '';
  const lines = [
    `${index + 1}. ${name} (${severity}) - ${alert.status}`,
    `   Instance: ${instance}`,
  ];

  if (summary) {
    lines.push(`   Summary: ${summary}`);
  }
  if (alert.startsAt) {
    lines.push(`   Started: ${alert.startsAt}`);
  }
  if (alert.endsAt) {
    lines.push(`   Ended: ${alert.endsAt}`);
  }

  return lines.join('\n');
}

export function formatAlertEmail(alerts: Alert[], webUrl: string, grafanaUrl: string): AlertEmail {
  const firing = alerts.filter((alert) => alert.status === 'firing').length;
  const resolved = alerts.length - firing;
  const status = firing > 0 ? 'FIRING' : 'RESOLVED';
  const names = [
    ...new Set(alerts.map((alert) => alert.labels.alertname ?? 'UnknownAlert')),
  ];
  const namePart = names.slice(0, 3).join(', ');
  const more = names.length > 3 ? ` +${names.length - 3} more` : '';

  const subject = `[Concert Ops] ${status}: ${namePart}${more}`;
  const body = [
    'Concert Ops alert notification',
    '',
    `Status: ${status}`,
    `Alerts: ${firing} firing, ${resolved} resolved`,
    '',
    ...alerts.map(alertLine),
    '',
    `Admin panel: ${webUrl}`,
    `Grafana: ${grafanaUrl}`,
  ].join('\n');

  return { subject, text: body };
}

export class AlertMailer {
  protected readonly transport: Transporter | null;

  constructor() {
    this.transport = notifyConfig.emailEnabled
      ? nodemailer.createTransport({
          host: notifyConfig.smtpHost,
          port: notifyConfig.smtpPort,
          secure: notifyConfig.smtpSecure,
          auth: notifyConfig.smtpUser
            ? {
                user: notifyConfig.smtpUser,
                pass: notifyConfig.smtpPassword,
              }
            : undefined,
          connectionTimeout: 5000,
          greetingTimeout: 5000,
          socketTimeout: 10_000,
        })
      : null;
  }

  get enabled(): boolean {
    return this.transport !== null;
  }

  async send(alerts: Alert[]): Promise<AlertEmailResult> {
    if (!this.transport) {
      return { messageId: '', accepted: [], rejected: [], response: 'email disabled' };
    }

    const message = formatAlertEmail(alerts, notifyConfig.webUrl, notifyConfig.grafanaUrl);

    const info = await this.transport.sendMail({
      from: notifyConfig.mailFrom,
      to: notifyConfig.mailTo,
      subject: message.subject,
      text: message.text,
    });

    return {
      messageId: info.messageId,
      accepted: (info.accepted ?? []).map(String),
      rejected: (info.rejected ?? []).map(String),
      response: info.response,
    };
  }
}
