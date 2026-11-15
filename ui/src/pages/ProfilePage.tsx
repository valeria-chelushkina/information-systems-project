import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorBox, PageLoader, StatusBadge } from '@/components/UI';
import { useAuth } from '@/context/AuthContext';
import { dateTime, errorMessage, money, shortDateTime } from '@/lib/format';
import { useApi } from '@/lib/useApi';
import type { CustomerOrder, Paged } from '@/lib/types';

const PAGE_SIZE = 10;

export function ProfilePage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const parsedOffset = Number(params.get('offset') ?? '0');
  const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? Math.floor(parsedOffset) : 0;
  const { data, error, loading, reload } = useApi<Paged<CustomerOrder>>(
    `/orders?limit=${PAGE_SIZE}&offset=${offset}`,
  );

  if (!user) {
    return null;
  }

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Account</span>
          <h1>My profile</h1>
          <p>
            Every account gets a profile automatically. Here you can see the orders and tickets
            you have bought.
          </p>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container">
          <div className="panel profile-account">
            <span className="avatar avatar--lg">{user.email.slice(0, 1).toUpperCase()}</span>
            <div className="profile-account__identity">
              <span className="profile-account__label">Signed in as</span>
              <strong>{user.email}</strong>
              <span className="muted">
                Account ID <span className="mono">{user.userId}</span>
              </span>
            </div>
            <div className="profile-account__role">
              <StatusBadge status={user.role} />
            </div>
          </div>

          <div className="page-head page-head--sub">
            <div>
              <h2>Your orders</h2>
              <p className="page-head__sub">
                {data
                  ? `${data.total} ${data.total === 1 ? 'order' : 'orders'} in total.`
                  : 'Loading your orders…'}
              </p>
            </div>
            <Link className="btn btn--ghost btn--sm" to="/events">
              Browse events
              <Icon name="arrow" className="icon icon--sm" />
            </Link>
          </div>

          {loading ? (
            <PageLoader text="Loading your tickets…" />
          ) : error ? (
            <ErrorBox message={errorMessage(error.code)} onRetry={reload} />
          ) : data && data.items.length > 0 ? (
            <>
              <div className="profile-orders">
                {data.items.map(({ order, tickets, event }) => (
                  <article key={order.id} className="panel profile-order">
                    <div className="profile-order__head">
                      <div>
                        <span className="profile-order__label">Order</span>
                        <h3>{event ? event.title : 'Event order'}</h3>
                        <p className="muted">
                          {event
                            ? `${dateTime(event.startsAt)} · ${event.venueName}`
                            : shortDateTime(order.createdAt)}
                        </p>
                      </div>
                      <StatusBadge status={order.status} />
                    </div>

                    <div className="profile-order__stats">
                      <span>
                        <small>Total</small>
                        <strong>{money(order.totalCents)}</strong>
                      </span>
                      <span>
                        <small>Tickets</small>
                        <strong>{tickets.length}</strong>
                      </span>
                      <span>
                        <small>Order ID</small>
                        <strong className="mono">{order.id.slice(0, 8)}…</strong>
                      </span>
                    </div>

                    <div className="profile-order__tickets">
                      {tickets.map((ticket) => (
                        <div key={ticket.id} className="profile-ticket">
                          <span className="mono">{ticket.id.slice(0, 8)}…</span>
                          <StatusBadge status={ticket.status} />
                        </div>
                      ))}
                    </div>

                    <div className="profile-order__actions">
                      <Link className="btn btn--ghost btn--sm" to={`/orders/${order.id}`}>
                        View tickets
                        <Icon name="arrow" className="icon icon--sm" />
                      </Link>
                    </div>
                  </article>
                ))}
              </div>
              <Pagination
                total={data.total}
                limit={data.limit}
                offset={data.offset}
                basePath="/profile"
              />
            </>
          ) : (
            <EmptyState
              iconName="ticket"
              title="No tickets yet"
              text="When you buy tickets, your orders and tickets will appear here."
              action={
                <Link className="btn btn--primary" to="/events">
                  Browse events
                </Link>
              }
            />
          )}
        </div>
      </section>
    </>
  );
}
