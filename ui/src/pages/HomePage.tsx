import { useMemo } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { EventCard } from '@/components/EventCard';
import { EventFilters } from '@/components/EventFilters';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorBox, PageLoader, SectionHead } from '@/components/UI';
import { HOME_EVENTS_LIMIT, HOME_TICKETS_LIMIT } from '@/constants/pagination.constants';
import { errorMessage, eventDate, eventDay, eventMonth, money } from '@/helpers/format';
import { useAuth } from '@/hooks/useAuth';
import { useApi } from '@/hooks/useApi';
import type { PublicEventsPage } from '@/typedefs/catalog.typedefs';
import type { Paged } from '@/typedefs/common.typedefs';
import type { CustomerOrder } from '@/typedefs/orders.typedefs';
import type {
  HeroTicketProps,
  PublicFilterState,
  TicketCardProps,
} from '@/typedefs/ui.typedefs';

function HeroTicket({ event }: HeroTicketProps) {
  if (!event) {
    return (
      <div className="hero-ticket">
        <div className="hero-ticket__top">
          <span className="chip chip--live">
            <span className="dot" /> live demo
          </span>
          <span className="hero-ticket__id">CP-2026</span>
        </div>
        <p className="hero-ticket__label">Next event</p>
        <h2>Events are coming soon</h2>
        <p className="hero-ticket__sub">Create an event in the control panel</p>
      </div>
    );
  }

  const price = event.minPriceCents === null ? '$45' : money(event.minPriceCents);

  return (
    <div className="hero-ticket">
      <div className="hero-ticket__top">
        <span className="chip chip--live">
          <span className="dot" /> live demo
        </span>
        <span className="hero-ticket__id">CP-2026</span>
      </div>
      <p className="hero-ticket__label">Next event</p>
      <h2>{event.title}</h2>
      <p className="hero-ticket__sub">
        {event.performerName} · {event.venueName}
      </p>
      <p className="hero-ticket__date">
        <Icon name="calendar" className="inline-icon" />
        {eventDate(event.startsAt)}
      </p>
      <div className="hero-ticket__seats">
        <span>
          <small>Section</small>A
        </span>
        <span>
          <small>Row</small>4
        </span>
        <span>
          <small>Seat</small>12
        </span>
      </div>
      <div className="hero-ticket__perf" />
      <div className="hero-ticket__bottom">
        <span>Doors in 60 min</span>
        <span className="hero-ticket__price">{price}</span>
      </div>
    </div>
  );
}

function TicketCard({ item }: TicketCardProps) {
  const event = item.event;

  if (!event) {
    return null;
  }

  const activeTickets = item.tickets.filter(
    (ticket) => ticket.status === 'issued' || ticket.status === 'checked_in',
  ).length;

  return (
    <article className="my-ticket">
      <div className="my-ticket__date">
        <span className="my-ticket__day">{eventDay(event.startsAt)}</span>
        <span className="my-ticket__month">{eventMonth(event.startsAt)}</span>
      </div>
      <div className="my-ticket__body">
        <h3>
          <Link to={`/orders/${item.order.id}`}>{event.title}</Link>
        </h3>
        <p>
          {eventDate(event.startsAt)} · {event.venueName}
        </p>
        <div className="my-ticket__meta">
          <span>
            {activeTickets} {activeTickets === 1 ? 'ticket' : 'tickets'}
          </span>
          <span>{event.performerName}</span>
        </div>
      </div>
      <div className="my-ticket__actions">
        <Link className="btn btn--ghost btn--sm" to={`/orders/${item.order.id}`}>
          View tickets
          <Icon name="arrow" className="icon icon--sm" />
        </Link>
      </div>
    </article>
  );
}

export function HomePage() {
  const { user } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const search = params.get('search') ?? '';
  const performerId = params.get('performerId') ?? '';
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';

  const query = new URLSearchParams({ limit: String(HOME_EVENTS_LIMIT) });

  if (search) query.set('search', search);
  if (performerId) query.set('performerId', performerId);
  if (from) query.set('from', from);
  if (to) query.set('to', to);

  const eventsState = useApi<PublicEventsPage>(`/public/events?${query.toString()}`);
  const ordersState = useApi<Paged<CustomerOrder>>(
    user ? '/orders?limit=50&offset=0' : null,
  );
  const events = eventsState.data?.items ?? [];
  const filters: PublicFilterState = { search, performerId, from, to };
  const hasFilters = Boolean(search || performerId || from || to);

  const upcomingTickets = useMemo(() => {
    const now = Date.now();

    return (ordersState.data?.items ?? [])
      .filter(
        (item) =>
          item.event !== null &&
          item.event.status !== 'cancelled' &&
          new Date(item.event.startsAt).getTime() >= now &&
          item.tickets.some(
            (ticket) => ticket.status === 'issued' || ticket.status === 'checked_in',
          ),
      )
      .sort(
        (left, right) =>
          new Date(left.event!.startsAt).getTime() - new Date(right.event!.startsAt).getTime(),
      );
  }, [ordersState.data]);

  const applyFilters = (next: PublicFilterState) => {
    const value = new URLSearchParams();

    if (next.search) value.set('search', next.search);
    if (next.performerId) value.set('performerId', next.performerId);
    if (next.from) value.set('from', next.from);
    if (next.to) value.set('to', next.to);

    const suffix = value.toString() ? `?${value.toString()}` : '';
    navigate(`/${suffix}#events`);
  };

  const allQuery = new URLSearchParams(query);
  allQuery.delete('limit');
  const allEventsHref = `/events${allQuery.toString() ? `?${allQuery.toString()}` : ''}`;

  return (
    <>
      {user ? (
        <section className="section section--top" id="tickets">
          <div className="container">
            <div className="page-head">
              <div>
                <span className="eyebrow">Your tickets</span>
                <h1>Upcoming tickets</h1>
                <p className="page-head__sub">
                  Your next events, ordered from soonest to latest.
                </p>
              </div>
              <Link className="btn btn--ghost btn--sm" to="/profile">
                All orders
                <Icon name="arrow" className="icon icon--sm" />
              </Link>
            </div>

            {ordersState.loading ? (
              <PageLoader text="Loading your tickets…" />
            ) : ordersState.error ? (
              <ErrorBox
                message={errorMessage(ordersState.error.code)}
                onRetry={ordersState.reload}
              />
            ) : upcomingTickets.length > 0 ? (
              <>
                <div className="ticket-grid">
                  {upcomingTickets.slice(0, HOME_TICKETS_LIMIT).map((item) => (
                    <TicketCard key={item.order.id} item={item} />
                  ))}
                </div>
                {upcomingTickets.length > HOME_TICKETS_LIMIT ? (
                  <p className="ticket-grid__more">
                    <Link className="link" to="/profile">
                      View all {upcomingTickets.length} upcoming tickets
                      <Icon name="arrow" className="icon icon--sm" />
                    </Link>
                  </p>
                ) : null}
              </>
            ) : (
              <div className="panel no-tickets">
                <Icon name="ticket" />
                <p>You have no events coming up.</p>
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="hero">
          <div className="container hero__inner">
            <div className="hero__copy">
              <h1>Concert Ops</h1>
              <p className="hero__lead">
                Buy tickets to your favourite performers — browse upcoming shows, reserve a
                seat and keep your tickets in one place.
              </p>
              <div className="hero__actions">
                <Link className="btn btn--primary btn--lg" to="/events">
                  Browse events
                  <Icon name="arrow" className="icon icon--sm" />
                </Link>
              </div>
            </div>
            <div className="hero__visual">
              <HeroTicket event={events[0]} />
            </div>
          </div>
        </section>
      )}

      <section className="section section--tight" id="events">
        <div className="container">
          <SectionHead
            eyebrow="Events"
            title="Upcoming events"
            text="All public events in one place. Availability updates after every purchase."
            action={
              <Link className="btn btn--ghost" to={allEventsHref}>
                All events
                <Icon name="arrow" className="icon icon--sm" />
              </Link>
            }
          />
          <EventFilters
            initial={filters}
            onSubmit={applyFilters}
            onReset={() => navigate('/#events')}
          />
          {eventsState.loading ? (
            <div className="event-grid">
              {Array.from({ length: 3 }, (_, index) => (
                <div key={index} className="skeleton skeleton--card" />
              ))}
            </div>
          ) : eventsState.error ? (
            <ErrorBox
              message={errorMessage(eventsState.error.code)}
              onRetry={eventsState.reload}
            />
          ) : events.length > 0 ? (
            <div className="event-grid">
              {events.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          ) : (
            <EmptyState
              iconName="calendar"
              title={hasFilters ? 'No events match these filters' : 'No events yet'}
              text={
                hasFilters
                  ? 'Try a different search, performer or date range.'
                  : 'Check back later for new concerts.'
              }
              action={
                hasFilters ? (
                  <button className="btn btn--ghost" type="button" onClick={() => navigate('/#events')}>
                    Reset filters
                  </button>
                ) : undefined
              }
            />
          )}
        </div>
      </section>
    </>
  );
}
