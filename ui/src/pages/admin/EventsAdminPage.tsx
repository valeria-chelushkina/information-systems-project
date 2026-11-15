import { useEffect, useState, type FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorBox, PageLoader, StatusBadge } from '@/components/UI';
import { eventDate, errorMessage } from '@/lib/format';
import { useApi } from '@/lib/useApi';
import type { EventsPage, Paged, Performer } from '@/lib/types';

const PAGE_SIZE = 20;

const FILTERS = [
  { key: '', label: 'All' },
  { key: 'draft', label: 'Drafts' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'on_sale', label: 'On sale' },
  { key: 'sold_out', label: 'Sold out' },
  { key: 'completed', label: 'Completed' },
  { key: 'cancelled', label: 'Cancelled' },
];

export function EventsAdminPage() {
  const [params, setParams] = useSearchParams();
  const status = params.get('status') ?? '';
  const search = params.get('search') ?? '';
  const performerId = params.get('performerId') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const parsedOffset = Number(params.get('offset') ?? '0');
  const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? Math.floor(parsedOffset) : 0;

  const [searchInput, setSearchInput] = useState(search);
  const [performerInput, setPerformerInput] = useState(performerId);
  const [fromInput, setFromInput] = useState(from);
  const [toInput, setToInput] = useState(to);

  useEffect(() => {
    setSearchInput(search);
    setPerformerInput(performerId);
    setFromInput(from);
    setToInput(to);
  }, [search, performerId, from, to]);

  const apiParams = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(offset) });

  if (status) apiParams.set('status', status);
  if (search) apiParams.set('search', search);
  if (performerId) apiParams.set('performerId', performerId);
  if (from) apiParams.set('from', from);
  if (to) apiParams.set('to', to);

  const { data, error, loading, reload } = useApi<EventsPage>(
    `/admin/events?${apiParams.toString()}`,
  );
  const performers = useApi<Paged<Performer>>('/admin/performers?limit=100&offset=0');

  const apply = (event: FormEvent) => {
    event.preventDefault();

    const next = new URLSearchParams();

    if (status) next.set('status', status);
    if (searchInput.trim()) next.set('search', searchInput.trim());
    if (performerInput) next.set('performerId', performerInput);
    if (fromInput) next.set('from', fromInput);
    if (toInput) next.set('to', toInput);

    setParams(next);
  };

  const reset = () => {
    setSearchInput('');
    setPerformerInput('');
    setFromInput('');
    setToInput('');
    setParams({});
  };

  const chipHref = (key: string): string => {
    const next = new URLSearchParams(params);
    next.delete('offset');

    if (key) {
      next.set('status', key);
    } else {
      next.delete('status');
    }

    const value = next.toString();
    return value ? `/admin/events?${value}` : '/admin/events';
  };

  const hasFilters = Boolean(status || search || performerId || from || to);

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Events</span>
          <h1>Manage events</h1>
          <p className="page-head__sub">
            {data ? `${data.total} events match the current filters.` : 'Loading events…'}
          </p>
        </div>
        <Link className="btn btn--primary" to="/admin/events/new">
          <Icon name="plus" className="icon icon--sm" />
          Create event
        </Link>
      </div>

      <form className="filters" onSubmit={apply}>
        <label className="field field--grow">
          <span className="field__label">Search</span>
          <input
            className="input"
            value={searchInput}
            placeholder="Title, performer or venue"
            onChange={(event) => setSearchInput(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">Performer</span>
          <select
            className="select"
            value={performerInput}
            onChange={(event) => setPerformerInput(event.target.value)}
          >
            <option value="">All performers</option>
            {(performers.data?.items ?? []).map((performer) => (
              <option key={performer.id} value={performer.id}>
                {performer.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field__label">From date</span>
          <input
            className="input"
            type="date"
            value={fromInput}
            onChange={(event) => setFromInput(event.target.value)}
          />
        </label>
        <label className="field">
          <span className="field__label">To date</span>
          <input
            className="input"
            type="date"
            value={toInput}
            onChange={(event) => setToInput(event.target.value)}
          />
        </label>
        <div className="filters__actions">
          <button className="btn btn--primary" type="submit">
            <Icon name="search" className="icon icon--sm" />
            Apply
          </button>
          {hasFilters ? (
            <button className="btn btn--ghost" type="button" onClick={reset}>
              Reset
            </button>
          ) : null}
        </div>
      </form>

      <div className="chips">
        {FILTERS.map((filter) => (
          <Link
            key={filter.key || 'all'}
            className={`chip chip--link${status === filter.key ? ' is-active' : ''}`}
            to={chipHref(filter.key)}
          >
            {filter.label}
          </Link>
        ))}
      </div>

      {loading ? (
        <PageLoader text="Loading events…" />
      ) : error ? (
        <ErrorBox message={errorMessage(error.code)} onRetry={reload} />
      ) : data && data.items.length > 0 ? (
        <>
          <div className="panel">
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Event</th>
                    <th>Performer</th>
                    <th>Venue</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((event) => (
                    <tr key={event.id}>
                      <td className="nowrap muted">{eventDate(event.startsAt)}</td>
                      <td>
                        <Link className="table-link" to={`/admin/events/${event.id}`}>
                          {event.title}
                        </Link>
                      </td>
                      <td>{event.performerName}</td>
                      <td>{event.venueName}</td>
                      <td>
                        <StatusBadge status={event.status} />
                      </td>
                      <td className="table-actions">
                        <Link className="btn btn--ghost btn--xs" to={`/admin/events/${event.id}`}>
                          Open
                        </Link>
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
            basePath="/admin/events"
            query={{ status, search, performerId, from, to }}
          />
        </>
      ) : (
        <EmptyState
          iconName="calendar"
          title="No events found"
          text="Try different filters or create a new event."
          action={
            <Link className="btn btn--primary" to="/admin/events/new">
              Create event
            </Link>
          }
        />
      )}
    </>
  );
}
