import { useState, type FormEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { ErrorBox, PageLoader, StatusBadge } from '@/components/UI';
import { useToast } from '@/context/ToastContext';
import { api, ApiError } from '@/lib/api';
import {
  dateTime,
  dollarsToCents,
  errorMessage,
  money,
  percent,
  toDollars,
} from '@/lib/format';
import { useApi } from '@/lib/useApi';
import type { EventDetail, Tier } from '@/lib/types';

const TRANSITION_LABELS: Record<string, string> = {
  draft: 'Back to draft',
  scheduled: 'Schedule',
  on_sale: 'Start sales',
  sold_out: 'Mark sold out',
  completed: 'Complete',
  cancelled: 'Cancel',
};

function TierEditor({ tier, onChanged }: { tier: Tier; onChanged: () => void }) {
  const { push } = useToast();
  const [name, setName] = useState(tier.name);
  const [price, setPrice] = useState(toDollars(tier.priceCents));
  const [totalQty, setTotalQty] = useState(String(tier.totalQty));
  const [busy, setBusy] = useState(false);
  const used = Math.max(tier.totalQty - tier.availableQty, 0);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const priceCents = dollarsToCents(price);
    const quantity = Number(totalQty);

    if (priceCents === null || !Number.isInteger(quantity) || quantity < 1) {
      push('Check the price and seat count.', 'error');
      return;
    }

    setBusy(true);

    try {
      await api.patch(`/admin/tiers/${tier.id}`, { name, priceCents, totalQty: quantity });
      push('Tier updated.');
      onChanged();
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : 'request_failed';
      push(errorMessage(code), 'error');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!window.confirm(`Delete the "${tier.name}" tier?`)) {
      return;
    }

    setBusy(true);

    try {
      await api.remove(`/admin/tiers/${tier.id}`);
      push('Tier deleted.');
      onChanged();
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : 'request_failed';
      push(errorMessage(code), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <article className="tier-admin">
      <div className="tier-admin__head">
        <h3>{tier.name}</h3>
        <span className="tier-admin__price">{money(tier.priceCents)}</span>
      </div>
      <div className="tier-admin__stats">
        <span>
          <strong>{tier.availableQty}</strong> available
        </span>
        <span>
          <strong>{tier.soldQty}</strong> sold
        </span>
        <span>
          <strong>{tier.heldQty}</strong> held
        </span>
      </div>
      <progress className="meter" max={Math.max(tier.totalQty, 1)} value={used} />
      <span className="tier-admin__share">
        {percent(used, tier.totalQty)}% sold of {tier.totalQty}
      </span>
      <form className="tier-admin__form" onSubmit={save}>
        <label className="field">
          <span className="field__label">Name</span>
          <input className="input input--sm" value={name} maxLength={100} onChange={(event) => setName(event.target.value)} required />
        </label>
        <label className="field">
          <span className="field__label">Price, $</span>
          <input className="input input--sm" value={price} inputMode="decimal" onChange={(event) => setPrice(event.target.value)} required />
        </label>
        <label className="field">
          <span className="field__label">Total seats</span>
          <input className="input input--sm" type="number" min={1} value={totalQty} onChange={(event) => setTotalQty(event.target.value)} required />
        </label>
        <div className="tier-admin__actions">
          <button className="btn btn--ghost btn--sm" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
      <button className="link link--danger" type="button" onClick={remove} disabled={busy}>
        Delete tier
      </button>
    </article>
  );
}

export function EventAdminPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { push } = useToast();
  const { data, error, loading, reload } = useApi<EventDetail>(id ? `/admin/events/${id}` : null);
  const [busy, setBusy] = useState(false);
  const [tierName, setTierName] = useState('');
  const [tierPrice, setTierPrice] = useState('');
  const [tierQty, setTierQty] = useState('');

  if (loading) {
    return <PageLoader text="Loading event…" />;
  }

  if (error || !data || !id) {
    return <ErrorBox message={errorMessage(error?.code)} onRetry={reload} />;
  }

  const { event, tiers, transitions } = data;
  const deletable = ['draft', 'scheduled', 'cancelled'].includes(event.status);

  const changeStatus = async (status: string) => {
    if ((status === 'cancelled' || status === 'completed') && !window.confirm(`Change the status to "${TRANSITION_LABELS[status]}"?`)) {
      return;
    }

    setBusy(true);

    try {
      await api.patch(`/admin/events/${event.id}`, { status });
      push('Status updated.');
      reload();
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : 'request_failed';
      push(errorMessage(code), 'error');
    } finally {
      setBusy(false);
    }
  };

  const removeEvent = async () => {
    if (!window.confirm('Delete this event permanently?')) {
      return;
    }

    setBusy(true);

    try {
      await api.remove(`/admin/events/${event.id}`);
      push('Event deleted.');
      navigate('/admin/events');
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : 'request_failed';
      push(errorMessage(code), 'error');
      setBusy(false);
    }
  };

  const addTier = async (formEvent: FormEvent) => {
    formEvent.preventDefault();
    const priceCents = dollarsToCents(tierPrice);
    const quantity = Number(tierQty);

    if (priceCents === null || !Number.isInteger(quantity) || quantity < 1) {
      push('Check the price and seat count.', 'error');
      return;
    }

    setBusy(true);

    try {
      await api.post(`/admin/events/${event.id}/tiers`, {
        name: tierName,
        priceCents,
        totalQty: quantity,
      });
      push('Tier added.');
      setTierName('');
      setTierPrice('');
      setTierQty('');
      reload();
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : 'request_failed';
      push(errorMessage(code), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <Link className="back-link" to="/admin/events">
            <Icon name="arrow" className="icon icon--sm icon--flip" />
            Events
          </Link>
          <h1>{event.title}</h1>
          <p className="page-head__sub">
            {event.performerName} · {event.venueName} · {dateTime(event.startsAt)}
          </p>
        </div>
        <div className="page-head__actions">
          <StatusBadge status={event.status} />
          <Link className="btn btn--ghost" to={`/events/${event.id}`} target="_blank" rel="noreferrer">
            <Icon name="external" className="icon icon--sm" />View on site
          </Link>
        </div>
      </div>

      <div className="detail-grid">
        <div className="panel">
          <div className="panel__head">
            <h2>Details</h2>
          </div>
          <dl className="facts">
            <div>
              <dt>Starts</dt>
              <dd>{dateTime(event.startsAt)}</dd>
            </div>
            <div>
              <dt>Doors</dt>
              <dd>{event.doorsAt ? dateTime(event.doorsAt) : '—'}</dd>
            </div>
            <div>
              <dt>Duration</dt>
              <dd>{event.durationMinutes ? `${event.durationMinutes} min` : '—'}</dd>
            </div>
            <div>
              <dt>On sale from</dt>
              <dd>{event.onSaleAt ? dateTime(event.onSaleAt) : '—'}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{dateTime(event.createdAt)}</dd>
            </div>
            <div>
              <dt>ID</dt>
              <dd className="mono">{event.id}</dd>
            </div>
          </dl>
        </div>

        <div className="panel">
          <div className="panel__head">
            <h2>Actions</h2>
          </div>
          <div className="action-row">
            {transitions.filter((status) => status !== event.status).length > 0 ? (
              transitions
                .filter((status) => status !== event.status)
                .map((status) => (
                  <button
                    key={status}
                    className={`btn btn--${status === 'cancelled' ? 'danger' : 'ghost'} btn--sm`}
                    type="button"
                    onClick={() => changeStatus(status)}
                    disabled={busy}
                  >
                    {TRANSITION_LABELS[status] ?? status}
                  </button>
                ))
            ) : (
              <span className="muted">Final status, no transitions available.</span>
            )}
          </div>
          {deletable ? (
            <button className="link link--danger" type="button" onClick={removeEvent} disabled={busy}>
              Delete event
            </button>
          ) : (
            <p className="muted">Deletion is unavailable: the event is on sale or completed.</p>
          )}
        </div>
      </div>

      <div className="page-head page-head--sub">
        <div>
          <h2>Ticket tiers</h2>
          <p className="page-head__sub">Prices are stored in cents; the form uses dollars.</p>
        </div>
      </div>

      {tiers.length > 0 ? (
        <div className="tier-admin-grid">
          {tiers.map((tier) => (
            <TierEditor key={tier.id} tier={tier} onChanged={reload} />
          ))}
        </div>
      ) : (
        <p className="muted">No ticket tiers yet. Add the first one below.</p>
      )}

      <div className="panel">
        <div className="panel__head">
          <h2>New tier</h2>
        </div>
        <form className="form-grid form-grid--inline" onSubmit={addTier}>
          <label className="field">
            <span className="field__label">Name</span>
            <input className="input" value={tierName} maxLength={100} placeholder="Fan zone" onChange={(event) => setTierName(event.target.value)} required />
          </label>
          <label className="field">
            <span className="field__label">Price, $</span>
            <input className="input" value={tierPrice} inputMode="decimal" placeholder="45.00" onChange={(event) => setTierPrice(event.target.value)} required />
          </label>
          <label className="field">
            <span className="field__label">Seat count</span>
            <input className="input" type="number" min={1} value={tierQty} placeholder="100" onChange={(event) => setTierQty(event.target.value)} required />
          </label>
          <div className="field field--action">
            <button className="btn btn--primary" type="submit" disabled={busy}>
              Add
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
