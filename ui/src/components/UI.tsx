import { Icon } from '@/components/Icon';
import { STATUS_TONES } from '@/constants/status.constants';
import { label } from '@/helpers/format';
import type {
  ErrorBoxProps,
  EmptyStateProps,
  PageLoaderProps,
  SectionHeadProps,
  StatCardProps,
  StatusBadgeProps,
} from '@/typedefs/ui.typedefs';

export function StatusBadge({ status, plain = false }: StatusBadgeProps) {
  const tone = STATUS_TONES[status] ?? 'muted';

  return (
    <span className={`badge badge--${tone}${plain ? ' badge--plain' : ''}`}>{label(status)}</span>
  );
}

export function PageLoader({ text = 'Loading…' }: PageLoaderProps) {
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
}: ErrorBoxProps) {
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
}: EmptyStateProps) {
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
}: SectionHeadProps) {
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
}: StatCardProps) {
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
