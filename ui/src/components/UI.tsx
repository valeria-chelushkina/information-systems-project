import type { ReactNode } from 'react';
import { Icon } from '@/components/Icon';
import { label } from '@/lib/format';

const TONES: Record<string, string> = {
  on_sale: 'ok',
  paid: 'ok',
  confirmed: 'ok',
  issued: 'ok',
  checked_in: 'ok',
  scheduled: 'info',
  completed: 'info',
  staff: 'info',
  requested: 'warn',
  pending: 'warn',
  draft: 'muted',
  cancelled: 'muted',
  refunded: 'muted',
  void: 'muted',
  customer: 'muted',
  rejected: 'danger',
  failed: 'danger',
  sold_out: 'brand',
  admin: 'brand',
};

export function StatusBadge({ status, plain = false }: { status: string; plain?: boolean }) {
  const tone = TONES[status] ?? 'muted';

  return (
    <span className={`badge badge--${tone}${plain ? ' badge--plain' : ''}`}>{label(status)}</span>
  );
}

export function PageLoader({ text = 'Loading…' }: { text?: string }) {
  return (
    <div className="page-loader">
      <span className="spinner" />
      <span>{text}</span>
    </div>
  );
}

export function ErrorBox({
  title = 'Could not load data',
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="error-box" role="alert">
      <Icon name="bell" className="error-box__icon" />
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
      {onRetry ? (
        <button className="btn btn--ghost btn--sm" type="button" onClick={onRetry}>
          Try again
        </button>
      ) : null}
    </div>
  );
}

export function EmptyState({
  iconName = 'spark',
  title,
  text,
  action,
}: {
  iconName?: string;
  title: string;
  text: string;
  action?: ReactNode;
}) {
  return (
    <div className="empty">
      <Icon name={iconName} className="empty__icon" />
      <h3>{title}</h3>
      <p>{text}</p>
      {action}
    </div>
  );
}

export function SectionHead({
  eyebrow,
  title,
  text,
  action,
}: {
  eyebrow: string;
  title: string;
  text?: string;
  action?: ReactNode;
}) {
  return (
    <div className={`section-head${action ? ' section-head--row' : ''}`}>
      <div>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {text ? <p>{text}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function StatCard({
  labelText,
  value,
  hint,
  iconName,
  tone = 'brand',
}: {
  labelText: string;
  value: number | string;
  hint: string;
  iconName: string;
  tone?: 'brand' | 'ok' | 'warn' | 'info';
}) {
  return (
    <article className={`stat stat--${tone}`}>
      <div className="stat__top">
        <span className="stat__label">{labelText}</span>
        <span className="stat__icon">
          <Icon name={iconName} />
        </span>
      </div>
      <strong className="stat__value">{value}</strong>
      <span className="stat__hint">{hint}</span>
    </article>
  );
}
