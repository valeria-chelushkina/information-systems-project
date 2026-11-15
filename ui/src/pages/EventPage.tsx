import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorBox, PageLoader, StatusBadge } from '@/components/UI';
import { api, ApiError } from '@/helpers/api';
import {
  dateTime,
  errorMessage,
  eventDay,
  eventMonth,
  eventTime,
  money,
  percent,
} from '@/helpers/format';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import { useToast } from '@/hooks/useToast';
import type { PerformerProfile, PublicEventDetail } from '@/typedefs/catalog.typedefs';
import type { PurchaseResult } from '@/typedefs/orders.typedefs';
import type { TierRowProps } from '@/typedefs/ui.typedefs';

function TierRow({ tier, eventId, eventStatus }: TierRowProps) {
  const { user } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const [quantity, setQuantity] = useState(1);
  const [busy, setBusy] = useState(false);
  const used = Math.max(tier.totalQty - tier.availableQty, 0);
  const max = Math.min(tier.availableQty, 6);

  const buy = async () => {
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/events/${eventId}`)}`);
      return;
    }

    setBusy(true);

    try {
      const result = await api.post<PurchaseResult>(`/events/${eventId}/purchase`, {
        tierId: tier.id,
        quantity,
      });

      navigate(`/orders/${result.orderId}?created=1`);
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : 'request_failed';
      push(errorMessage(code), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="tier">
      <div className="tier__head">
        <span className="tier__name">{tier.name}</span>
        <span className="tier__price">{money(tier.priceCents)}</span>
      </div>
      <div className="tier__meta">
        <span>
          {tier.availableQty} of {tier.totalQty} available
        </span>
        <span>{percent(used, tier.totalQty)}% sold</span>
      </div>
      <progress className="meter" max={Math.max(tier.totalQty, 1)} value={used} />
      {eventStatus !== 'on_sale' ? (
        <span className="tier__closed">
          {eventStatus === 'sold_out' ? 'Sold out' : 'Sales closed'}
        </span>
      ) : tier.availableQty <= 0 ? (
        <span className="tier__closed">No seats available</span>
      ) : (
        <div className="tier__form">
          <label className="qty">
            <span className="qty__label">Qty</span>
            <select
              className="select select--sm"
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value))}
            >
              {Array.from({ length: max }, (_, index) => (
                <option key={index + 1} value={index + 1}>
                  {index + 1}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn--primary btn--sm" type="button" onClick={buy} disabled={busy}>
            {busy ? 'Holding…' : 'Buy'}
          </button>
        </div>
      )}
    </li>
  );
}

export function EventPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi<PublicEventDetail>(
    id ? `/public/events/${id}` : null,
  );
  const performerState = useApi<PerformerProfile>(
    data ? `/public/performers/${data.event.performerId}` : null,
  );

  if (loading) {
    return <PageLoader text="Loading event…" />;
  }

  if (error || !data) {
    const notFound = error?.status === 404;

    return (
      <section className="section section--top">
        <div className="container narrow">
          {notFound ? (
            <EmptyState
              iconName="calendar"
              title="Event not found"
              text="The event may have been cancelled or already finished."
              action={
                <Link className="btn btn--primary" to="/events">
                  Browse events
                </Link>
              }
            />
          ) : (
            <ErrorBox message={errorMessage(error?.code)} onRetry={reload} />
          )}
        </div>
      </section>
    );
  }

  const { event, tiers } = data;
  const cheapest = tiers.reduce<number | null>(
    (min, tier) => (min === null || tier.priceCents < min ? tier.priceCents : min),
    null,
  );

  return (
    <>
      <section className="event-hero">
        <div className="container">
          <Link className="back-link" to="/events">
            <Icon name="arrow" className="icon icon--sm icon--flip" />
            Events
          </Link>
          <div className="event-hero__top">
            <div className="event-hero__date">
              <span>{eventDay(event.startsAt)}</span>
              <small>{eventMonth(event.startsAt)}</small>
            </div>
            <div className="event-hero__copy">
              <div className="event-hero__badges">
                <StatusBadge status={event.status} plain />
                <span className="meta-time">
                  <Icon name="clock" className="icon icon--sm" />
                  {eventTime(event.startsAt)}
                </span>
              </div>
              <h1>{event.title}</h1>
              <p className="event-hero__performer">
                <Icon name="mic" className="inline-icon" />
                {event.performerName}
              </p>
              <p className="event-hero__venue">
                <Icon name="pin" className="inline-icon" />
                {event.venueName}
              </p>
              {performerState.data?.bio ? (
                <p className="event-hero__bio">{performerState.data.bio}</p>
              ) : null}
            </div>
          </div>
        </div>
      </section>
      <section className="section section--tight">
        <div className="container detail-grid">
          <div className="detail-main">
            <div className="panel">
              <h2>About the event</h2>
              <p>
                Prices are per ticket. After purchase your tickets appear on the order page and
                the seats are reserved for you.
              </p>
              <dl className="facts">
                <div>
                  <dt>Starts</dt>
                  <dd>{dateTime(event.startsAt)}</dd>
                </div>
                {event.doorsAt ? (
                  <div>
                    <dt>Doors</dt>
                    <dd>{dateTime(event.doorsAt)}</dd>
                  </div>
                ) : null}
                {event.durationMinutes ? (
                  <div>
                    <dt>Duration</dt>
                    <dd>{event.durationMinutes} min</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Venue</dt>
                  <dd>{event.venueName}</dd>
                </div>
                <div>
                  <dt>Cheapest ticket</dt>
                  <dd>{cheapest === null ? '—' : money(cheapest)}</dd>
                </div>
              </dl>
            </div>
          </div>
          <aside className="detail-aside">
            <div className="panel panel--sticky">
              <div className="panel__head">
                <h2>Tickets</h2>
                {cheapest === null ? null : <span className="panel__note">from {money(cheapest)}</span>}
              </div>
              {tiers.length > 0 ? (
                <ul className="tier-list">
                  {tiers.map((tier) => (
                    <TierRow key={tier.id} tier={tier} eventId={event.id} eventStatus={event.status} />
                  ))}
                </ul>
              ) : (
                <p className="muted">Ticket tiers have not been added yet.</p>
              )}
              <p className="panel__hint">
                <Icon name="clock" className="inline-icon" />
                Hold lasts 10 minutes
              </p>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
}
