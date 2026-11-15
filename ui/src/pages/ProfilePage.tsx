import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { OrderFilters } from '@/components/OrderFilters';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorBox, PageLoader, StatusBadge } from '@/components/UI';
import { PROFILE_PAGE_SIZE } from '@/constants/pagination.constants';
import { dateTime, errorMessage, money, shortDateTime } from '@/helpers/format';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import type { Paged } from '@/typedefs/common.typedefs';
import type { CustomerOrder } from '@/typedefs/orders.typedefs';
import type { OrderFilterState } from '@/typedefs/ui.typedefs';

export function ProfilePage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const performerId = params.get('performerId') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const parsedOffset = Number(params.get('offset') ?? '0');
  const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? Math.floor(parsedOffset) : 0;
  const query = new URLSearchParams({
    limit: String(PROFILE_PAGE_SIZE),
    offset: String(offset),
  });

  if (performerId) query.set('performerId', performerId);
  if (from) query.set('from', from);
  if (to) query.set('to', to);

  const { data, error, loading, reload } = useApi<Paged<CustomerOrder>>(
    `/orders?${query.toString()}`,
  );
  const filters: OrderFilterState = { performerId, from, to };
  const hasFilters = Boolean(performerId || from || to);

  const applyFilters = (next: OrderFilterState) => {
    const value = new URLSearchParams();

    if (next.performerId) value.set('performerId', next.performerId);
    if (next.from) value.set('from', next.from);
    if (next.to) value.set('to', next.to);

    const suffix = value.toString() ? `?${value.toString()}` : '';
    navigate(`/profile${suffix}`);
  };

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
                  ? hasFilters
                    ? `${data.total} matching ${data.total === 1 ? 'order' : 'orders'}.`
                    : `${data.total} ${data.total === 1 ? 'order' : 'orders'} in total.`
                  : 'Loading your orders…'}
              </p>
            </div>
            <Link className="btn btn--ghost btn--sm" to="/events">
              Browse events
              <Icon name="arrow" className="icon icon--sm" />
            </Link>
          </div>

          <OrderFilters
            initial={filters}
            onSubmit={applyFilters}
            onReset={() => navigate('/profile')}
          />

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
                query={{ performerId, from, to }}
              />
            </>
          ) : hasFilters ? (
            <EmptyState
              iconName="search"
              title="No matching orders"
              text="Try another performer or a wider date range."
              action={
                <button className="btn btn--ghost" type="button" onClick={() => navigate('/profile')}>
                  Clear filters
                </button>
              }
            />
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
