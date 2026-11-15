import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { StatusBadge } from '@/components/UI';
import { eventDate, eventDay, eventMonth, money } from '@/lib/format';
import type { PublicEventCard } from '@/lib/types';

export function EventCard({ event }: { event: PublicEventCard }) {
  const price = event.minPriceCents === null ? 'Prices TBA' : `from ${money(event.minPriceCents)}`;
  const time = eventDate(event.startsAt).split(', ').slice(1).join(', ');

  return (
    <article className="event-card">
      <div className="event-card__date">
        <span className="event-card__day">{eventDay(event.startsAt)}</span>
        <span className="event-card__month">{eventMonth(event.startsAt)}</span>
      </div>
      <div className="event-card__body">
        <div className="event-card__meta">
          <span className="chip">
            <Icon name="clock" className="chip__icon" />
            {time}
          </span>
          <StatusBadge status={event.status} />
        </div>
        <h3>
          <Link to={`/events/${event.id}`}>{event.title}</Link>
        </h3>
        <p className="event-card__performer">
          <Icon name="mic" className="inline-icon" />
          {event.performerName}
        </p>
        <p className="event-card__venue">
          <Icon name="pin" className="inline-icon" />
          {event.venueName}
        </p>
      </div>
      <div className="event-card__footer">
        <span className="event-card__price">{price}</span>
        <Link className="event-card__link" to={`/events/${event.id}`}>
          {event.status === 'sold_out' ? 'Details' : 'Tickets'}
          <Icon name="arrow" className="icon icon--sm" />
        </Link>
      </div>
    </article>
  );
}
