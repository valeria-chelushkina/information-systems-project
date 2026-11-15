import { useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorBox, PageLoader, StatusBadge } from '@/components/UI';
import { useToast } from '@/hooks/useToast';
import { api, ApiError } from '@/helpers/api';
import { dateTime, errorMessage, money, shortDateTime } from '@/helpers/format';
import { useApi } from '@/hooks/useApi';
import type { OrderDetail } from '@/typedefs/orders.typedefs';

export function OrderPage() {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { push } = useToast();
  const { data, error, loading, reload } = useApi<OrderDetail>(id ? `/orders/${id}` : null);
  const [busy, setBusy] = useState(false);
  const created = params.get('created') === '1';

  const refund = async () => {
    if (!id || !window.confirm('Refund this order?')) {
      return;
    }

    setBusy(true);

    try {
      await api.post(`/orders/${id}/refund`);
      push('Refund complete. Seats are back on sale.');
      reload();
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : 'request_failed';
      push(errorMessage(code), 'error');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return <PageLoader text="Loading order…" />;
  }

  if (error || !data) {
    return (
      <section className="section section--top">
        <div className="container narrow">
          {error?.status === 403 ? (
            <EmptyState
              iconName="shield"
              title="Access denied"
              text="This order belongs to another customer."
              action={
                <Link className="btn btn--primary" to="/events">
                  Browse events
                </Link>
              }
            />
          ) : (
            <ErrorBox
              title="Order not found"
              message={errorMessage(error?.code)}
              onRetry={reload}
            />
          )}
        </div>
      </section>
    );
  }

  const { order, tickets, event, tierNames, canRefund } = data;
  const showCreated = created && order.status === 'paid';

  return (
    <section className="section section--top">
      <div className="container narrow">
        {showCreated ? (
          <div className="success-hero">
            <Icon name="check" className="success-hero__icon" />
            <div>
              <h1>Your tickets are ready</h1>
              <p>Payment confirmed and tickets issued. Show this page at the door.</p>
            </div>
          </div>
        ) : (
          <div className="page-head">
            <div>
              <Link className="back-link" to="/events">
                <Icon name="arrow" className="icon icon--sm icon--flip" />
                Events
              </Link>
              <h1>Order</h1>
            </div>
          </div>
        )}

        <div className="order-card">
          <div className="order-card__head">
            <div>
              <span className="order-card__label">Order</span>
              <span className="mono">{order.id}</span>
            </div>
            <StatusBadge status={order.status} />
          </div>
          <div className="order-card__grid">
            <div>
              <span>Total</span>
              <strong>{money(order.totalCents)}</strong>
            </div>
            <div>
              <span>Tickets</span>
              <strong>{tickets.length}</strong>
            </div>
            <div>
              <span>Email</span>
              <strong>{order.customerEmail}</strong>
            </div>
            <div>
              <span>Created</span>
              <strong>{dateTime(order.createdAt)}</strong>
            </div>
          </div>
          {event ? (
            <div className="order-card__event">
              <Icon name="ticket" className="inline-icon" />
              <div>
                <span>Event</span>
                <Link to={`/events/${event.id}`}>{event.title}</Link>
                <small>
                  {dateTime(event.startsAt)} · {event.venueName}
                </small>
              </div>
            </div>
          ) : null}
        </div>

        <div className="panel">
          <div className="panel__head">
            <h2>Tickets</h2>
            <span className="panel__note">{tickets.length} total</span>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Ticket</th>
                  <th>Tier</th>
                  <th>Price</th>
                  <th>Status</th>
                  <th>Issued</th>
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <span className="mono">{ticket.id.slice(0, 8)}…</span>
                    </td>
                    <td>{tierNames[ticket.tierId] ?? 'Tier'}</td>
                    <td>{money(ticket.unitPriceCents)}</td>
                    <td>
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="muted">{shortDateTime(ticket.issuedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {canRefund ? (
          <div className="panel panel--muted">
            <h3>Refund</h3>
            <p>Refunding cancels the tickets and returns the seats to sale. This cannot be undone.</p>
            <button className="btn btn--danger" type="button" onClick={refund} disabled={busy}>
              {busy ? 'Refunding…' : `Refund ${money(order.totalCents)}`}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
