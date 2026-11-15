import { type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { ErrorBox, PageLoader, SectionHead, StatCard } from '@/components/UI';
import { dateTime, errorMessage, money } from '@/helpers/format';
import { useApi } from '@/hooks/useApi';
import type { EventReport, Reports } from '@/typedefs/report.typedefs';

const RANGE_DAYS = 30;

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function defaultRange(): { from: string; to: string } {
  const to = new Date();
  const from = new Date(to.getTime() - (RANGE_DAYS - 1) * 24 * 60 * 60 * 1000);

  return { from: isoDay(from), to: isoDay(to) };
}

function csvCell(value: string | number): string {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function exportEvents(rows: EventReport[], from: string, to: string): void {
  const header = [
    'Event',
    'Performer',
    'Starts at',
    'Status',
    'Tickets sold',
    'Revenue (cents)',
    'Capacity',
    'Occupancy %',
  ];
  const body = rows.map((row) => [
    row.title,
    row.performerName,
    row.startsAt,
    row.status,
    row.ticketsSold,
    row.revenueCents,
    row.capacity,
    row.occupancyPct,
  ]);
  const csv = [header, ...body].map((line) => line.map(csvCell).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `concert-ops-events-${from}-${to}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

export function ReportsPage() {
  const [params, setParams] = useSearchParams();
  const fallback = defaultRange();
  const from = params.get('from') ?? fallback.from;
  const to = params.get('to') ?? fallback.to;
  const { data, error, loading, reload } = useApi<Reports>(
    `/admin/reports?from=${from}&to=${to}`,
  );

  const apply = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setParams({
      from: String(form.get('from') ?? from),
      to: String(form.get('to') ?? to),
    });
  };

  const reset = () => setParams({});

  const events = data?.byEvent ?? [];
  const performers = data?.byPerformer ?? [];
  const maxRevenue = Math.max(1, ...events.map((row) => row.revenueCents));
  const maxPerformer = Math.max(1, ...performers.map((row) => row.revenueCents));

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Reports</span>
          <h1>Analytics</h1>
          <p className="page-head__sub">
            Revenue, occupancy and refunds for {from} to {to}.
          </p>
        </div>
        <button
          className="btn btn--ghost"
          type="button"
          disabled={events.length === 0}
          onClick={() => exportEvents(events, from, to)}
        >
          <Icon name="report" className="icon icon--sm" />
          Export CSV
        </button>
      </div>

      <form className="filters filters--reports" onSubmit={apply}>
        <label className="field">
          <span className="field__label">From date</span>
          <input className="input" type="date" name="from" defaultValue={from} key={`from-${from}`} />
        </label>
        <label className="field">
          <span className="field__label">To date</span>
          <input className="input" type="date" name="to" defaultValue={to} key={`to-${to}`} />
        </label>
        <div className="filters__actions">
          <button className="btn btn--primary" type="submit">
            Apply
          </button>
          <button className="btn btn--ghost" type="button" onClick={reset}>
            Reset
          </button>
        </div>
      </form>

      {loading ? (
        <PageLoader text="Building report…" />
      ) : error ? (
        <ErrorBox message={errorMessage(error.code)} onRetry={reload} />
      ) : data ? (
        <>
          <div className="stat-grid">
            <StatCard
              labelText="Revenue"
              value={money(data.totals.revenueCents)}
              hint={`${data.totals.orders} orders in range`}
              iconName="cart"
              tone="ok"
            />
            <StatCard
              labelText="Tickets sold"
              value={data.totals.ticketsSold}
              hint={`${events.length} events with sales`}
              iconName="ticket"
            />
            <StatCard
              labelText="Checked in"
              value={data.totals.ticketsCheckedIn}
              hint="admitted at the door"
              iconName="check"
              tone="info"
            />
            <StatCard
              labelText="Refunded"
              value={money(data.totals.refundedCents)}
              hint="returned to customers"
              iconName="pulse"
              tone="warn"
            />
          </div>

          <div className="report-grid">
            <div className="panel">
              <SectionHead eyebrow="Events" title="Revenue by event" />
              {events.length === 0 ? (
                <p className="muted">No sales in this range.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Event</th>
                        <th>Sold</th>
                        <th>Occupancy</th>
                        <th>Revenue</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <span className="report-name">{row.title}</span>
                            <small className="report-meta">
                              {row.performerName} · {dateTime(row.startsAt)}
                            </small>
                          </td>
                          <td>
                            {row.ticketsSold} / {row.capacity}
                          </td>
                          <td>
                            <span className="report-bar">
                              <span style={{ width: `${row.occupancyPct}%` }} />
                            </span>
                            <small className="report-meta">{row.occupancyPct}%</small>
                          </td>
                          <td>
                            <span className="report-bar">
                              <span
                                style={{ width: `${Math.round((row.revenueCents / maxRevenue) * 100)}%` }}
                              />
                            </span>
                            <small className="report-meta">{money(row.revenueCents)}</small>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="panel">
              <SectionHead eyebrow="Performers" title="Top performers" />
              {performers.length === 0 ? (
                <p className="muted">No sales in this range.</p>
              ) : (
                <ul className="report-bars">
                  {performers.map((row) => (
                    <li key={row.performerId}>
                      <span className="report-name">{row.performerName}</span>
                      <span className="report-bar">
                        <span
                          style={{ width: `${Math.round((row.revenueCents / maxPerformer) * 100)}%` }}
                        />
                      </span>
                      <small className="report-meta">
                        {money(row.revenueCents)} · {row.ticketsSold} tickets
                      </small>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}
