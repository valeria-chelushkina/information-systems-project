export const TIME_ZONE = 'Europe/Kyiv';

const moneyFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

export function money(cents: number): string {
  return moneyFormatter.format(cents / 100);
}

export function toDollars(cents: number): string {
  return (cents / 100).toFixed(2);
}

export function dollarsToCents(value: string): number | null {
  const match = /^(\d{1,7})(?:[.,](\d{1,2}))?$/.exec(value.trim());

  if (!match) {
    return null;
  }

  const whole = Number(match[1]);
  const fraction = (match[2] ?? '').padEnd(2, '0');

  return whole * 100 + Number(fraction);
}

const eventDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

const eventTimeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

const shortFormatter = new Intl.DateTimeFormat('en-US', {
  month: '2-digit',
  day: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  timeZone: TIME_ZONE,
});

const dayFormatter = new Intl.DateTimeFormat('en-US', {
  day: 'numeric',
  timeZone: TIME_ZONE,
});

const monthFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  timeZone: TIME_ZONE,
});

export function eventDate(iso: string): string {
  return eventDateFormatter.format(new Date(iso));
}

export function eventTime(iso: string): string {
  return eventTimeFormatter.format(new Date(iso));
}

export function dateTime(iso: string): string {
  return fullDateFormatter.format(new Date(iso));
}

export function shortDateTime(iso: string): string {
  return shortFormatter.format(new Date(iso));
}

export function eventDay(iso: string): string {
  return dayFormatter.format(new Date(iso));
}

export function eventMonth(iso: string): string {
  return monthFormatter.format(new Date(iso)).replace('.', '').toUpperCase();
}

export function toLocalInput(iso: string | null): string {
  if (!iso) {
    return '';
  }

  const parts = new Intl.DateTimeFormat('sv-SE', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: TIME_ZONE,
  }).format(new Date(iso));

  return parts.replace(' ', 'T');
}

export function percent(part: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.round((part / total) * 100);
}

export const STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  on_sale: 'On sale',
  sold_out: 'Sold out',
  completed: 'Completed',
  cancelled: 'Cancelled',
  requested: 'Requested',
  confirmed: 'Confirmed',
  rejected: 'Rejected',
  paid: 'Paid',
  refunded: 'Refunded',
  pending: 'Pending',
  failed: 'Failed',
  issued: 'Issued',
  checked_in: 'Checked in',
  void: 'Void',
  admin: 'Admin',
  staff: 'Staff',
  customer: 'Customer',
};

export function label(value: string): string {
  return STATUS_LABELS[value] ?? value;
}

export const ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: 'Incorrect email or password.',
  user_inactive: 'This account is disabled.',
  missing_token: 'Please sign in to continue.',
  invalid_token: 'Your session has expired. Please sign in again.',
  forbidden: 'You do not have permission to do that.',
  forbidden_origin: 'The request origin was rejected.',
  validation_failed: 'Please check the form fields.',
  email_taken: 'An account with this email already exists.',
  insufficient_inventory: 'Not enough seats are available in this tier.',
  invalid_status_transition: 'This status change is not allowed.',
  event_not_on_sale: 'Ticket sales for this event are closed.',
  event_has_sales: 'An event with sales cannot be deleted.',
  event_not_found: 'Event not found.',
  price_tier_not_found: 'Ticket tier not found.',
  price_tier_in_use: 'This tier still has sold or held seats.',
  booking_conflict: 'The venue is already booked for this period.',
  booking_not_pending: 'This booking has already been processed.',
  order_not_found: 'Order not found.',
  order_not_refundable: 'This order cannot be refunded.',
  upstream_unavailable: 'The service is temporarily unavailable. Please try again.',
  network: 'Cannot reach the server.',
  not_found: 'Resource not found.',
};

export function errorMessage(code: string | undefined): string {
  if (!code) {
    return 'Something went wrong.';
  }

  return ERROR_MESSAGES[code] ?? 'Something went wrong.';
}
