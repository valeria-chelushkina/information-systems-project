import nodemailer, { type Transporter } from 'nodemailer';
import { notifyConfig } from '@/services/notify/config.js';
import type { PurchaseCompletedEvent } from '@/shared/messaging/purchase-event.typedefs.js';

export interface TicketEmail {
  subject: string;
  text: string;
  html: string;
}

export interface TicketEmailResult {
  messageId: string;
  accepted: string[];
  rejected: string[];
  response: string;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatMoney(cents: number, currency: string): string {
  return `${currency} ${(cents / 100).toFixed(2)}`;
}

function formatStartsAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Kyiv',
  }).format(date);
}

export function formatTicketEmail(event: PurchaseCompletedEvent, webUrl: string): TicketEmail {
  const startsAt = formatStartsAt(event.event.startsAt);
  const total = formatMoney(event.totalCents, event.currency);
  const orderUrl = `${webUrl}/orders/${event.orderId}`;
  const count = event.tickets.length;

  const subject = `Your tickets: ${event.event.title}`;

  const text = [
    'Concert Ops',
    '',
    `Thank you for your purchase. ${count} ${count === 1 ? 'ticket is' : 'tickets are'} attached below.`,
    '',
    `Order: ${event.orderId}`,
    `Event: ${event.event.title}`,
    `Performer: ${event.event.performerName}`,
    `Venue: ${event.event.venueName}`,
    `Starts: ${startsAt}`,
    `Total: ${total}`,
    '',
    'Tickets:',
    ...event.tickets.map(
      (ticket, index) => `${index + 1}. ${ticket.tierName} - code ${ticket.code}`,
    ),
    '',
    'Show this code at the door. Each code admits one person.',
    `View your order: ${orderUrl}`,
  ].join('\n');

  const rows = event.tickets
    .map(
      (ticket, index) => `
        <tr>
          <td style="padding:8px 12px;border-bottom:1px solid #ece9ff;">${index + 1}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #ece9ff;">${escapeHtml(ticket.tierName)}</td>
          <td style="padding:8px 12px;border-bottom:1px solid #ece9ff;font-family:monospace;font-size:14px;">
            ${escapeHtml(ticket.code)}
          </td>
        </tr>`,
    )
    .join('');

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:24px;background:#f6f4ff;font-family:Arial,sans-serif;color:#1f1b2e;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e4defc;border-radius:12px;padding:24px;">
      <h1 style="margin:0 0 4px;font-size:22px;color:#5b3df5;">Concert Ops</h1>
      <p style="margin:0 0 20px;color:#5f5a72;">Your tickets for ${escapeHtml(event.event.title)}.</p>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;">
        <tr><td style="padding:4px 0;color:#5f5a72;">Order</td><td style="padding:4px 0;text-align:right;">${escapeHtml(event.orderId)}</td></tr>
        <tr><td style="padding:4px 0;color:#5f5a72;">Performer</td><td style="padding:4px 0;text-align:right;">${escapeHtml(event.event.performerName)}</td></tr>
        <tr><td style="padding:4px 0;color:#5f5a72;">Venue</td><td style="padding:4px 0;text-align:right;">${escapeHtml(event.event.venueName)}</td></tr>
        <tr><td style="padding:4px 0;color:#5f5a72;">Starts</td><td style="padding:4px 0;text-align:right;">${escapeHtml(startsAt)}</td></tr>
        <tr><td style="padding:4px 0;color:#5f5a72;">Total</td><td style="padding:4px 0;text-align:right;"><strong>${escapeHtml(total)}</strong></td></tr>
      </table>

      <table style="width:100%;border-collapse:collapse;margin-bottom:20px;font-size:14px;">
        <thead>
          <tr style="background:#f6f4ff;text-align:left;">
            <th style="padding:8px 12px;">#</th>
            <th style="padding:8px 12px;">Tier</th>
            <th style="padding:8px 12px;">Entry code</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <p style="margin:0 0 16px;color:#5f5a72;">Show this code at the door. Each code admits one person.</p>
      <a href="${escapeHtml(orderUrl)}" style="display:inline-block;background:#5b3df5;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:8px;">View your order</a>
    </div>
  </body>
</html>`;

  return { subject, text, html };
}

export class TicketMailer {
  protected readonly transport: Transporter | null;

  constructor() {
    if (notifyConfig.ticketEmailTransport === 'smtp') {
      this.transport = notifyConfig.smtpHost
        ? nodemailer.createTransport({
            host: notifyConfig.smtpHost,
            port: notifyConfig.smtpPort,
            secure: notifyConfig.smtpSecure,
            auth: notifyConfig.smtpUser
              ? { user: notifyConfig.smtpUser, pass: notifyConfig.smtpPassword }
              : undefined,
            connectionTimeout: 5000,
            greetingTimeout: 5000,
            socketTimeout: 10_000,
          })
        : null;
    } else {
      this.transport = nodemailer.createTransport({
        host: notifyConfig.mailpitHost,
        port: notifyConfig.mailpitPort,
        secure: false,
        connectionTimeout: 5000,
        greetingTimeout: 5000,
        socketTimeout: 10_000,
      });
    }
  }

  get enabled(): boolean {
    return this.transport !== null;
  }

  async send(event: PurchaseCompletedEvent): Promise<TicketEmailResult> {
    if (!this.transport) {
      throw new Error('ticket email transport is not configured');
    }

    const message = formatTicketEmail(event, notifyConfig.webUrl);
    const info = await this.transport.sendMail({
      from: notifyConfig.ticketEmailFrom,
      to: event.customerEmail,
      subject: message.subject,
      text: message.text,
      html: message.html,
    });

    return {
      messageId: info.messageId,
      accepted: (info.accepted ?? []).map(String),
      rejected: (info.rejected ?? []).map(String),
      response: info.response,
    };
  }
}
