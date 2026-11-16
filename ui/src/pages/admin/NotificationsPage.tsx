import { useSearchParams } from 'react-router-dom';
import { Pagination } from '@/components/Pagination';
import { ErrorBox, PageLoader, StatusBadge } from '@/components/UI';
import { useApi } from '@/hooks/useApi';
import { shortDateTime } from '@/helpers/format';
import type { NotificationDelivery, NotificationSummary } from '@/typedefs/admin.typedefs';
import type { Paged } from '@/typedefs/common.typedefs';
import { ADMIN_PAGE_SIZE } from '@/constants/pagination.constants';

export function NotificationsPage() {
  const [params] = useSearchParams();
  const parsedOffset = Number(params.get('offset') ?? '0');
  const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? Math.floor(parsedOffset) : 0;
  const { data, error, loading, reload } = useApi<Paged<NotificationDelivery>>(
    `/admin/notifications?limit=${ADMIN_PAGE_SIZE}&offset=${offset}`,
  );
  const { data: summary } = useApi<NotificationSummary>('/admin/notifications/summary');

  const counts = summary?.byStatus;

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Messaging</span>
          <h1>Ticket emails</h1>
          <p className="page-head__sub">
            Every purchase event is claimed once, rendered and sent by the notify worker. Failures
            are retried with a delay and parked in the dead-letter queue after the last attempt. The
            last error stays visible after a successful retry.
          </p>
        </div>
      </div>

      <div className="panel">
        <div className="panel__head">
          <h2>Deliveries</h2>
          <div className="badge-row">
            <span className="badge badge--ok">Delivered {counts?.delivered ?? 0}</span>
            <span className="badge badge--warn">Retrying {counts?.retrying ?? 0}</span>
            <span className="badge badge--danger">Dead-lettered {counts?.dead ?? 0}</span>
            <span className="badge badge--muted">Skipped {counts?.skipped ?? 0}</span>
          </div>
        </div>
        {loading ? (
          <PageLoader />
        ) : error ? (
          <ErrorBox message="Could not load deliveries" onRetry={reload} />
        ) : data && data.items.length > 0 ? (
          <>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Updated</th>
                    <th>Order</th>
                    <th>Recipient</th>
                    <th>Status</th>
                    <th>Attempts</th>
                    <th>Last error</th>
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((delivery) => (
                    <tr key={delivery.eventId}>
                      <td className="muted nowrap">{shortDateTime(delivery.updatedAt)}</td>
                      <td>
                        <span className="mono">{delivery.orderId.slice(0, 8)}</span>
                      </td>
                      <td>{delivery.recipient}</td>
                      <td>
                        <StatusBadge status={delivery.status} />
                      </td>
                      <td>{delivery.attempts}</td>
                      <td className="muted">
                        {delivery.lastError
                          ? delivery.status === 'delivered'
                            ? `Recovered after: ${delivery.lastError}`
                            : delivery.lastError
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination
              total={data.total}
              limit={data.limit}
              offset={data.offset}
              basePath="/admin/notifications"
            />
          </>
        ) : (
          <p className="muted">No ticket emails have been processed yet.</p>
        )}
      </div>
    </>
  );
}
