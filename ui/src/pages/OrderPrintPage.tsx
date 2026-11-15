import { Link, useParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { TicketQr } from '@/components/TicketQr';
import { EmptyState, ErrorBox, PageLoader, StatusBadge } from '@/components/UI';
import { dateTime, errorMessage } from '@/helpers/format';
import { useApi } from '@/hooks/useApi';
import type { OrderDetail } from '@/typedefs/orders.typedefs';

const ACTIVE_STATUSES = new Set(['issued', 'checked_in']);

export function OrderPrintPage() {
  const { id } = useParams();
  const { data, error, loading, reload } = useApi<OrderDetail>(
    id ? `/orders/${id}` : null,
  );

  if (loading) {
    return <PageLoader text="Loading tickets…" />;
  }

  if (error || !data) {
    return (
      <section className="section section--top">
        <div className="container narrow">
          <ErrorBox message={errorMessage(error?.code)} onRetry={reload} />
        </div>
      </section>
    );
  }

  const tickets = data.tickets.filter((ticket) => ACTIVE_STATUSES.has(ticket.status));
  const event = data.event;

  return (
    <section className="section section--top print-page">
      <div className="container">
        <div className="page-head print-actions">
          <div>
            <Link className="back-link" to={`/orders/${data.order.id}`}>
              <Icon name="arrow" className="icon icon--sm icon--flip" />
              Back to order
            </Link>
            <div className="print-heading">
              <span className="eyebrow">Order tickets</span>
              <h1>{event?.title ?? 'Tickets'}</h1>
              <p className="page-head__sub">
                {event
                  ? `${dateTime(event.startsAt)} · ${event.venueName} · ${tickets.length} ${
                      tickets.length === 1 ? 'ticket' : 'tickets'
                    }`
                  : `Order ${data.order.id}`}
              </p>
            </div>
          </div>
          <div className="page-head__actions">
            <button
              className="btn btn--primary"
              type="button"
              disabled={tickets.length === 0}
              onClick={() => window.print()}
            >
              <Icon name="report" className="icon icon--sm" />
              Print / Save as PDF
            </button>
          </div>
        </div>

        {tickets.length === 0 ? (
          <EmptyState
            iconName="ticket"
            title="No printable tickets"
            text="This order has no active tickets."
            action={
              <Link className="btn btn--ghost" to={`/orders/${data.order.id}`}>
                Back to order
              </Link>
            }
          />
        ) : (
          <div className="print-grid">
            {tickets.map((ticket) => (
              <article className="print-ticket" key={ticket.id}>
                <div className="print-ticket__qr">
                  <TicketQr token={ticket.qrToken} />
                </div>
                <div className="print-ticket__body">
                  <span className="print-ticket__label">Admit one</span>
                  <h2>{event?.title ?? 'Concert Ops ticket'}</h2>
                  <p className="print-ticket__meta">
                    {event ? `${dateTime(event.startsAt)} · ${event.venueName}` : 'Event details unavailable'}
                  </p>
                  <p className="print-ticket__meta">
                    {event?.performerName ?? 'Performer'} ·{' '}
                    {data.tierNames[ticket.tierId] ?? 'Ticket'}
                  </p>
                  <div className="print-ticket__footer">
                    <span className="mono">Code {ticket.qrToken.slice(0, 8)}</span>
                    <StatusBadge status={ticket.status} />
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
