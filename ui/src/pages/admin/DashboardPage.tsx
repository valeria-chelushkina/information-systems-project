import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { ErrorBox, PageLoader, StatCard, StatusBadge } from '@/components/UI';
import { useAuth } from '@/hooks/useAuth';
import { eventDate, errorMessage } from '@/helpers/format';
import { useApi } from '@/hooks/useApi';
import type { Dashboard } from '@/typedefs/admin.typedefs';

export function DashboardPage() {
  const { data, error, loading, reload } = useApi<Dashboard>('/admin/dashboard');
  const { user } = useAuth();

  if (loading) {
    return <PageLoader text="Loading overview…" />;
  }

  if (error || !data) {
    return <ErrorBox message={errorMessage(error?.code)} onRetry={reload} />;
  }

  const stats = [
    {
      labelText: 'Events',
      value: data.counts.events,
      hint: `${data.counts.onSale} on sale`,
      iconName: 'calendar',
      tone: 'brand' as const,
    },
    {
      labelText: 'Bookings',
      value: data.counts.bookings,
      hint: 'awaiting decision',
      iconName: 'ticket',
      tone: 'warn' as const,
    },
    {
      labelText: 'Performers',
      value: data.counts.performers,
      hint: 'in the catalogue',
      iconName: 'mic',
      tone: 'info' as const,
    },
    {
      labelText: 'Venues',
      value: data.counts.venues,
      hint: 'in the catalogue',
      iconName: 'pin',
      tone: 'ok' as const,
    },
  ];

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Overview</span>
          <h1>Control panel</h1>
          <p className="page-head__sub">Platform status and quick actions.</p>
        </div>
        <Link className="btn btn--primary" to="/admin/events/new">
          <Icon name="plus" className="icon icon--sm" />
          Create event
        </Link>
      </div>

      <div className="stat-grid">
        {stats.map((stat) => (
          <StatCard key={stat.labelText} {...stat} />
        ))}
      </div>

      <div className="dash-grid">
        <div className="panel">
          <div className="panel__head">
            <h2>Recent events</h2>
            <Link className="link" to="/admin/events">
              All events
              <Icon name="arrow" className="icon icon--xs" />
            </Link>
          </div>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Event</th>
                  <th>Date</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.recentEvents.length > 0 ? (
                  data.recentEvents.map((event) => (
                    <tr key={event.id}>
                      <td>
                        <Link
                          className="table-link table-link--clamp"
                          to={`/admin/events/${event.id}`}
                          title={event.title}
                        >
                          {event.title}
                        </Link>
                      </td>
                      <td className="muted nowrap">{eventDate(event.startsAt)}</td>
                      <td>
                        <StatusBadge status={event.status} />
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={3}>
                      <div className="table-empty">No events yet. Create your first event.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="dash-side">
          <div className="panel">
            <div className="panel__head">
              <h2>Service status</h2>
            </div>
            <div className="health-list">
              {(
                [
                  ['ticketing', data.health.ticketing],
                  ['catalog', data.health.catalog],
                  ['auth', data.health.auth],
                ] as const
              ).map(([name, healthy]) => (
                <span key={name} className={`health ${healthy ? 'health--ok' : 'health--down'}`}>
                  <span className="dot" />
                  {name}
                  <small>{healthy ? 'operational' : 'unavailable'}</small>
                </span>
              ))}
            </div>
            <Link className="btn btn--ghost btn--block" to="/admin/orders">
              Look up an order
            </Link>
          </div>

          <div className="panel">
            <div className="panel__head">
              <h2>Quick actions</h2>
            </div>
            <div className="quick-actions">
              <Link to="/admin/events/new">
                <Icon name="calendar" />
                <span>New event</span>
                <Icon name="arrow" className="icon icon--sm" />
              </Link>
              <Link to="/admin/performers">
                <Icon name="mic" />
                <span>Add performer</span>
                <Icon name="arrow" className="icon icon--sm" />
              </Link>
              <Link to="/admin/venues">
                <Icon name="pin" />
                <span>Add venue</span>
                <Icon name="arrow" className="icon icon--sm" />
              </Link>
              {user?.role === 'admin' ? (
                <Link to="/admin/users">
                  <Icon name="users" />
                  <span>Manage team</span>
                  <Icon name="arrow" className="icon icon--sm" />
                </Link>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
