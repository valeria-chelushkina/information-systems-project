import { Link, useSearchParams } from 'react-router-dom';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorBox, PageLoader, StatusBadge } from '@/components/UI';
import { useToast } from '@/context/ToastContext';
import { api, ApiError } from '@/lib/api';
import { errorMessage, shortDateTime } from '@/lib/format';
import { useApi } from '@/lib/useApi';
import type { BookingsPage } from '@/lib/types';

const PAGE_SIZE = 20;

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'requested', label: 'Requests' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'rejected', label: 'Rejected' },
  { key: 'cancelled', label: 'Cancelled' },
];

export function BookingsPage() {
  const [params] = useSearchParams();
  const status = params.get('status') ?? '';
  const parsedOffset = Number(params.get('offset') ?? '0');
  const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? Math.floor(parsedOffset) : 0;

  const apiParams = new URLSearchParams({
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });

  if (status) apiParams.set('status', status);

  const { data, error, loading, reload } = useApi<BookingsPage>(
    `/admin/bookings?${apiParams.toString()}`,
  );
  const { push } = useToast();

  const decide = async (id: string, decision: 'confirmed' | 'rejected') => {
    try {
      await api.post(`/admin/bookings/${id}/decision`, { status: decision });
      push(decision === 'confirmed' ? 'Booking confirmed.' : 'Booking rejected.');
      reload();
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : 'request_failed';
      push(errorMessage(code), 'error');
    }
  };

  const rows = data?.bookings ?? [];

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Catalogue</span>
          <h1>Venue bookings</h1>
          <p className="page-head__sub">
            Confirmation is enforced by an exclusion constraint — two bookings cannot overlap.
          </p>
        </div>
      </div>

      <div className="chips">
        {FILTERS.map((filter) => {
          const href = filter.key ? `/admin/bookings?status=${filter.key}` : '/admin/bookings';

          return (
            <Link
              key={filter.key || 'all'}
              className={`chip chip--link${status === filter.key ? ' is-active' : ''}`}
              to={href}
            >
              {filter.label}
            </Link>
          );
        })}
      </div>

      {loading ? (
        <PageLoader text="Loading bookings…" />
      ) : error ? (
        <ErrorBox message={errorMessage(error.code)} onRetry={reload} />
      ) : data && rows.length > 0 ? (
        <>
          <div className="panel">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Period</th>
                    <th>Performer</th>
                    <th>Venue</th>
                    <th>Status</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((booking) => (
                    <tr key={booking.id}>
                      <td className="nowrap">
                        <strong>{shortDateTime(booking.startsAt)}</strong>
                        <br />
                        <span className="muted">to {shortDateTime(booking.endsAt)}</span>
                      </td>
                      <td>{data.performerNames[booking.performerId] ?? booking.performerId.slice(0, 8)}</td>
                      <td>{data.venueNames[booking.venueId] ?? booking.venueId.slice(0, 8)}</td>
                      <td>
                        <StatusBadge status={booking.status} />
                      </td>
                      <td className="muted nowrap">{shortDateTime(booking.createdAt)}</td>
                      <td className="table-actions">
                        {booking.status === 'requested' ? (
                          <div className="action-row">
                            <button className="btn btn--primary btn--xs" type="button" onClick={() => decide(booking.id, 'confirmed')}>
                              Confirm
                            </button>
                            <button className="btn btn--ghost btn--xs" type="button" onClick={() => decide(booking.id, 'rejected')}>
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span className="muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <Pagination
            total={data.total}
            limit={data.limit}
            offset={data.offset}
            basePath="/admin/bookings"
            query={{ status }}
          />
        </>
      ) : (
        <EmptyState
          iconName="ticket"
          title="No bookings found"
          text="Requests are created through the API or load scenarios."
        />
      )}
    </>
  );
}
