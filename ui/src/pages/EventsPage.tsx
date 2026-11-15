import { useMemo } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { EventCard } from '@/components/EventCard';
import { EventFilters } from '@/components/EventFilters';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorBox } from '@/components/UI';
import { EVENTS_PAGE_SIZE } from '@/constants/pagination.constants';
import { errorMessage } from '@/helpers/format';
import { useApi } from '@/hooks/useApi';
import type { PublicEventsPage } from '@/typedefs/catalog.typedefs';
import type { PublicFilterState } from '@/typedefs/ui.typedefs';

export function EventsPage() {
  const [params, setParams] = useSearchParams();
  const search = params.get('search') ?? '';
  const performerId = params.get('performerId') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const parsedOffset = Number(params.get('offset') ?? '0');
  const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? Math.floor(parsedOffset) : 0;

  const apiParams = useMemo(() => {
    const value = new URLSearchParams({
      limit: String(EVENTS_PAGE_SIZE),
      offset: String(offset),
    });

    if (search) value.set('search', search);
    if (performerId) value.set('performerId', performerId);
    if (from) value.set('from', from);
    if (to) value.set('to', to);

    return value.toString();
  }, [offset, search, performerId, from, to]);

  const { data, error, loading, reload } = useApi<PublicEventsPage>(`/public/events?${apiParams}`);
  const filters: PublicFilterState = { search, performerId, from, to };
  const hasFilters = Boolean(search || performerId || from || to);

  const apply = (next: PublicFilterState) => {
    const value = new URLSearchParams();

    if (next.search) value.set('search', next.search);
    if (next.performerId) value.set('performerId', next.performerId);
    if (next.from) value.set('from', next.from);
    if (next.to) value.set('to', next.to);

    setParams(value);
  };

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Events</span>
          <h1>Upcoming concerts</h1>
          <p>Search events, filter by performer or pick a date range.</p>
        </div>
      </section>
      <section className="section section--tight">
        <div className="container">
          <EventFilters
            initial={filters}
            onSubmit={apply}
            onReset={() => setParams({})}
          />

          {loading ? (
            <div className="event-grid">
              {Array.from({ length: 6 }, (_, index) => (
                <div key={index} className="skeleton skeleton--card" />
              ))}
            </div>
          ) : error ? (
            <ErrorBox message={errorMessage(error.code)} onRetry={reload} />
          ) : data && data.items.length > 0 ? (
            <>
              <div className="event-grid">
                {data.items.map((event) => (
                  <EventCard key={event.id} event={event} />
                ))}
              </div>
              <Pagination
                total={data.total}
                limit={data.limit}
                offset={data.offset}
                basePath="/events"
                query={{ search, performerId, from, to }}
              />
            </>
          ) : (
            <EmptyState
              iconName="calendar"
              title={hasFilters ? 'No events match these filters' : 'No events yet'}
              text={
                hasFilters
                  ? 'Try a different search, performer or date range.'
                  : 'Check back later — new concerts appear here as soon as they are published.'
              }
              action={
                hasFilters ? (
                  <button className="btn btn--ghost" type="button" onClick={() => setParams({})}>
                    Reset filters
                  </button>
                ) : (
                  <Link className="btn btn--primary" to="/">
                    Back home
                  </Link>
                )
              }
            />
          )}
        </div>
      </section>
    </>
  );
}
