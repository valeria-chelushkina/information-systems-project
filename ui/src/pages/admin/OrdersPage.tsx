import { useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorBox, PageLoader, StatusBadge } from '@/components/UI';
import { useToast } from '@/hooks/useToast';
import { api, ApiError } from '@/helpers/api';
import { dateTime, errorMessage, money, shortDateTime } from '@/helpers/format';
import { useApi } from '@/hooks/useApi';
import type { OrderDetail } from '@/typedefs/orders.typedefs';

export function OrdersPage() {
  const [params, setParams] = useSearchParams();
  const id = params.get('id') ?? '';
  const [query, setQuery] = useState(id);
  const { data, error, loading, reload } = useApi<OrderDetail>(id ? `/admin/orders/${id}` : null);
  const { push } = useToast();
  const [busy, setBusy] = useState(false);

  const search = (event: FormEvent) => {
    event.preventDefault();
    setParams(query.trim() ? { id: query.trim() } : {});
  };

  const refund = async () => {
    if (!window.confirm('Refund this order?')) {
      return;
    }

    setBusy(true);

    try {
      await api.post(`/admin/orders/${id}/refund`);
      push('Refund complete. Seats are back on sale.');
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
          <span className="eyebrow">Sales</span>
          <h1>Orders</h1>
          <p className="page-head__sub">
            Look up an order by ID, inspect tickets and issue refunds.
          </p>
        </div>
      </div>

      <div className="panel">
        <form className="search" onSubmit={search}>
          <label className="field field--grow">
            <span className="field__label">Order ID</span>
            <input
              className="input"
              value={query}
              placeholder="00000000-0000-0000-0000-000000000000"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button className="btn btn--primary" type="submit">
            <Icon name="search" className="icon icon--sm" />
            Search
          </button>
        </form>
      </div>

      {loading ? (
        <PageLoader text="Looking up the order…" />
      ) : error ? (
        <ErrorBox title="Order not found" message={errorMessage(error.code)} />
      ) : data ? (
        <div className="panel">
          <div className="panel__head">
            <h2>Order</h2>
            <StatusBadge status={data.order.status} />
          </div>
          <dl className="facts">
            <div>
              <dt>ID</dt>
              <dd className="mono">{data.order.id}</dd>
            </div>
            <div>
              <dt>Total</dt>
              <dd>
                <strong>{money(data.order.totalCents)}</strong>
              </dd>
            </div>
            <div>
              <dt>Email</dt>
              <dd>{data.order.customerEmail}</dd>
            </div>
            <div>
              <dt>Customer</dt>
              <dd className="mono">{data.order.customerRef}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{dateTime(data.order.createdAt)}</dd>
            </div>
            {data.event ? (
              <div>
                <dt>Event</dt>
                <dd>
                  <Link className="link" to={`/events/${data.event.id}`} target="_blank" rel="noreferrer">
                    {data.event.title}
                  </Link>
                </dd>
              </div>
            ) : null}
          </dl>

          <div className="panel__head panel__head--sub">
            <h3>Tickets</h3>
            <span className="panel__note">{data.tickets.length} total</span>
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
                {data.tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td className="mono">{ticket.id.slice(0, 8)}…</td>
                    <td>{data.tierNames[ticket.tierId] ?? ticket.tierId.slice(0, 8)}</td>
                    <td>{money(ticket.unitPriceCents)}</td>
                    <td>
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="muted nowrap">{shortDateTime(ticket.issuedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.order.status === 'paid' ? (
            <>
              <div className="panel__head panel__head--sub">
                <h3>Refund</h3>
              </div>
              <p className="muted">
                Refunding returns the seats to sale and marks the tickets as refunded.
              </p>
              <button className="btn btn--danger" type="button" onClick={refund} disabled={busy}>
                {busy ? 'Refunding…' : `Refund ${money(data.order.totalCents)}`}
              </button>
            </>
          ) : null}
        </div>
      ) : (
        <EmptyState
          iconName="cart"
          title="Enter an order ID"
          text="Orders are created when customers buy tickets or through load scenarios."
        />
      )}
    </>
  );
}
