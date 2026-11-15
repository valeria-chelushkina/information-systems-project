import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { ErrorBox, PageLoader } from '@/components/UI';
import { useToast } from '@/hooks/useToast';
import { api, ApiError } from '@/helpers/api';
import { errorMessage } from '@/helpers/format';
import { useApi } from '@/hooks/useApi';
import type { EventRecord, Performer, Venue } from '@/typedefs/catalog.typedefs';
import type { Paged } from '@/typedefs/common.typedefs';

export function NewEventPage() {
  const navigate = useNavigate();
  const { push } = useToast();
  const performers = useApi<Paged<Performer>>('/admin/performers?limit=100&offset=0');
  const venues = useApi<Paged<Venue>>('/admin/venues?limit=100&offset=0');
  const [title, setTitle] = useState('');
  const [performerId, setPerformerId] = useState('');
  const [venueId, setVenueId] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [doorsAt, setDoorsAt] = useState('');
  const [duration, setDuration] = useState('');
  const [status, setStatus] = useState<'draft' | 'scheduled'>('draft');
  const [busy, setBusy] = useState(false);

  if (performers.loading || venues.loading) {
    return <PageLoader text="Preparing the form…" />;
  }

  if (performers.error || venues.error) {
    return (
      <ErrorBox
        message={errorMessage((performers.error ?? venues.error)?.code)}
        onRetry={() => {
          performers.reload();
          venues.reload();
        }}
      />
    );
  }

  const performerList = performers.data?.items ?? [];
  const venueList = venues.data?.items ?? [];
  const missing = performerList.length === 0 || venueList.length === 0;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);

    try {
      const created = await api.post<EventRecord>('/admin/events', {
        title,
        performerId,
        venueId,
        startsAt,
        ...(doorsAt ? { doorsAt } : {}),
        ...(duration ? { durationMinutes: Number(duration) } : {}),
        status,
      });

      push('Event created. Add ticket tiers next.');
      navigate(`/admin/events/${created.id}`);
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : 'request_failed';
      push(errorMessage(code), 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Events</span>
          <h1>New event</h1>
          <p className="page-head__sub">
            Performer and venue names are stored on the event as a historical snapshot.
          </p>
        </div>
        <Link className="btn btn--ghost" to="/admin/events">
          <Icon name="arrow" className="icon icon--sm icon--flip" />
          Back to list
        </Link>
      </div>

      {missing ? (
        <div className="callout">
          <Icon name="bell" className="inline-icon" />
          Add{' '}
          {performerList.length === 0 ? <Link to="/admin/performers">a performer</Link> : null}
          {performerList.length === 0 && venueList.length === 0 ? ' and ' : null}
          {venueList.length === 0 ? <Link to="/admin/venues">a venue</Link> : null} first.
        </div>
      ) : null}

      <form className="panel form" onSubmit={submit}>
        <div className="form-grid">
          <label className="field field--wide">
            <span className="field__label">Event title</span>
            <input
              className="input"
              value={title}
              maxLength={200}
              placeholder="For example, Nova Wave: Neon Tour"
              onChange={(event) => setTitle(event.target.value)}
              required
            />
          </label>
          <label className="field">
            <span className="field__label">Performer</span>
            <select className="select" value={performerId} onChange={(event) => setPerformerId(event.target.value)} required>
              <option value="">Choose a performer</option>
              {performerList.map((performer) => (
                <option key={performer.id} value={performer.id}>
                  {performer.name}
                  {performer.genre ? ` · ${performer.genre}` : ''}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Venue</span>
            <select className="select" value={venueId} onChange={(event) => setVenueId(event.target.value)} required>
              <option value="">Choose a venue</option>
              {venueList.map((venue) => (
                <option key={venue.id} value={venue.id}>
                  {venue.name} · {venue.city} · {venue.capacity} seats
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span className="field__label">Starts</span>
            <input className="input" type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} required />
          </label>
          <label className="field">
            <span className="field__label">Doors (optional)</span>
            <input className="input" type="datetime-local" value={doorsAt} onChange={(event) => setDoorsAt(event.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Duration, min</span>
            <input className="input" type="number" min={1} max={1440} value={duration} placeholder="120" onChange={(event) => setDuration(event.target.value)} />
          </label>
          <label className="field">
            <span className="field__label">Initial status</span>
            <select className="select" value={status} onChange={(event) => setStatus(event.target.value as 'draft' | 'scheduled')}>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
            </select>
          </label>
        </div>
        <p className="form__hint">
          <Icon name="clock" className="inline-icon" />
          Times are entered in Kyiv time. Add ticket tiers after creating the event.
        </p>
        <div className="form-actions">
          <button className="btn btn--primary" type="submit" disabled={busy || missing}>
            {busy ? 'Creating…' : 'Create event'}
          </button>
          <Link className="btn btn--ghost" to="/admin/events">
            Cancel
          </Link>
        </div>
      </form>
    </>
  );
}
