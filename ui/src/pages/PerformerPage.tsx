import { Link, useParams } from 'react-router-dom';
import { EventCard } from '@/components/EventCard';
import { Icon } from '@/components/Icon';
import { EmptyState, ErrorBox, PageLoader, SectionHead } from '@/components/UI';
import { errorMessage } from '@/helpers/format';
import { useApi } from '@/hooks/useApi';
import type { PerformerProfile, PublicEventsPage } from '@/typedefs/catalog.typedefs';

export function PerformerPage() {
  const { id } = useParams();
  const profile = useApi<PerformerProfile>(id ? `/public/performers/${id}` : null);
  const events = useApi<PublicEventsPage>(
    id ? `/public/events?performerId=${id}&limit=9&offset=0` : null,
  );

  if (profile.loading) {
    return <PageLoader text="Loading performer…" />;
  }

  if (profile.error || !profile.data) {
    return (
      <section className="section section--top">
        <div className="container narrow">
          <EmptyState
            iconName="mic"
            title="Performer not found"
            text="This artist is not in the catalogue."
            action={
              <Link className="btn btn--primary" to="/performers">
                All performers
              </Link>
            }
          />
        </div>
      </section>
    );
  }

  const performer = profile.data;
  const upcoming = events.data?.items ?? [];

  return (
    <>
      <section className="event-hero">
        <div className="container">
          <Link className="back-link" to="/performers">
            <Icon name="arrow" className="icon icon--sm icon--flip" />
            Performers
          </Link>
          <div className="performer-hero">
            <span className="eyebrow">{performer.genre ?? 'Artist'}</span>
            <h1>{performer.name}</h1>
            <p className="performer-profile__bio">
              {performer.bio ?? 'Biography coming soon.'}
            </p>
          </div>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container">
          <SectionHead eyebrow="Live" title="Upcoming events" />
          {events.loading ? (
            <PageLoader text="Loading events…" />
          ) : events.error ? (
            <ErrorBox message={errorMessage(events.error.code)} onRetry={events.reload} />
          ) : upcoming.length === 0 ? (
            <p className="muted">No upcoming events for this performer.</p>
          ) : (
            <div className="event-grid">
              {upcoming.map((event) => (
                <EventCard key={event.id} event={event} />
              ))}
            </div>
          )}
        </div>
      </section>
    </>
  );
}
