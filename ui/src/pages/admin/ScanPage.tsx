import { useState, type FormEvent } from 'react';
import { Icon } from '@/components/Icon';
import { ErrorBox, PageLoader, StatusBadge } from '@/components/UI';
import { api, ApiError } from '@/helpers/api';
import { dateTime } from '@/helpers/format';
import { useToast } from '@/hooks/useToast';
import type { CheckInResult } from '@/typedefs/orders.typedefs';

function failureMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.code === 'ticket_already_checked_in') {
      const checkedInAt = (error.details as { checkedInAt?: string | null } | undefined)
        ?.checkedInAt;

      if (checkedInAt) {
        return `Ticket was already checked in at ${dateTime(checkedInAt)}.`;
      }
    }

    return error.message;
  }

  return 'Check-in failed';
}

export function ScanPage() {
  const { push } = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CheckInResult | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const qrToken = code.trim();

    if (!qrToken) {
      return;
    }

    setBusy(true);
    setError(null);
    setResult(null);

    try {
      const checked = await api.post<CheckInResult>('/admin/tickets/check-in', { qrToken });
      setResult(checked);
      setCode('');
      push('Ticket checked in.');
    } catch (caught) {
      setError(failureMessage(caught));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Door</span>
          <h1>Check in tickets</h1>
          <p className="page-head__sub">
            Enter the code printed under the ticket QR to admit one visitor.
          </p>
        </div>
      </div>

      <div className="panel">
        <form className="scanner__form" onSubmit={submit}>
          <label className="field">
            <span className="field__label">Ticket code</span>
            <input
              className="input"
              value={code}
              placeholder="For example ac1b4e8d"
              onChange={(event) => setCode(event.target.value)}
            />
          </label>
          <button className="btn btn--primary" type="submit" disabled={busy}>
            <Icon name="check" className="icon icon--sm" />
            {busy ? 'Checking…' : 'Check in'}
          </button>
        </form>
        <p className="scanner__hint">
          The eight-character code under the QR works, as does the full QR value.
        </p>
      </div>

      {busy ? <PageLoader text="Checking ticket…" /> : null}

      {error ? <ErrorBox title="Ticket not accepted" message={error} /> : null}

      {result ? (
        <div className="panel checkin-result">
          <span className="checkin-result__icon">
            <Icon name="check" />
          </span>
          <div>
            <span className="eyebrow">Admitted</span>
            <h2>{result.event.title}</h2>
            <p>
              {dateTime(result.event.startsAt)} · {result.event.venueName}
            </p>
            <div className="checkin-result__meta">
              <span className="mono">{result.ticket.id.slice(0, 8)}</span>
              <StatusBadge status={result.ticket.status} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
