import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorBox, PageLoader } from '@/components/UI';
import { useToast } from '@/context/ToastContext';
import { api, ApiError } from '@/lib/api';
import { dateTime, errorMessage } from '@/lib/format';
import { useApi } from '@/lib/useApi';
import type { Paged, Venue } from '@/lib/types';

const PAGE_SIZE = 20;

export function VenuesPage() {
  const { push } = useToast();
  const [params] = useSearchParams();
  const parsedOffset = Number(params.get('offset') ?? '0');
  const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? Math.floor(parsedOffset) : 0;
  const { data, error, loading, reload } = useApi<Paged<Venue>>(
    `/admin/venues?limit=${PAGE_SIZE}&offset=${offset}`,
  );
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [timezone, setTimezone] = useState('Europe/Kyiv');
  const [capacity, setCapacity] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);

    try {
      await api.post('/admin/venues', { name, city, timezone, capacity: Number(capacity) });
      push('Venue added.');
      setName('');
      setCity('');
      setCapacity('');
      reload();
    } catch (caught) {
      const code = caught instanceof ApiError ? caught.code : 'request_failed';
      push(errorMessage(code), 'error');
    } finally {
      setBusy(false);
    }
  };

  const rows = data?.items ?? [];

  return (
    <>
      <div className="page-head">
        <div>
          <span className="eyebrow">Catalogue</span>
          <h1>Venues</h1>
          <p className="page-head__sub">
            Capacity and time zone are used when planning events.
          </p>
        </div>
      </div>
      <div className="split">
        <div className="panel">
          <div className="panel__head">
            <h2>Add venue</h2>
          </div>
          <form className="form" onSubmit={submit}>
            <label className="field">
              <span className="field__label">Name</span>
              <input className="input" value={name} maxLength={160} placeholder="Kyiv Sound Hall" onChange={(event) => setName(event.target.value)} required />
            </label>
            <div className="form-grid">
              <label className="field">
                <span className="field__label">City</span>
                <input className="input" value={city} maxLength={120} placeholder="Kyiv" onChange={(event) => setCity(event.target.value)} required />
              </label>
              <label className="field">
                <span className="field__label">Time zone</span>
                <input className="input" value={timezone} maxLength={64} onChange={(event) => setTimezone(event.target.value)} />
              </label>
            </div>
            <label className="field">
              <span className="field__label">Capacity</span>
              <input className="input" type="number" min={1} value={capacity} placeholder="2500" onChange={(event) => setCapacity(event.target.value)} required />
            </label>
            <div className="form-actions">
              <button className="btn btn--primary" type="submit" disabled={busy}>
                Add
              </button>
            </div>
          </form>
        </div>
        <div className="panel">
          <div className="panel__head">
            <h2>Total: {data?.total ?? 0}</h2>
          </div>
          {loading ? (
            <PageLoader />
          ) : error ? (
            <ErrorBox message={errorMessage(error.code)} onRetry={reload} />
          ) : data && data.items.length > 0 ? (
            <>
              <div className="table-wrap">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>City</th>
                      <th>Time zone</th>
                      <th>Capacity</th>
                      <th>Added</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((venue) => (
                      <tr key={venue.id}>
                        <td>
                          <strong>{venue.name}</strong>
                        </td>
                        <td>{venue.city}</td>
                        <td>{venue.timezone}</td>
                        <td>{venue.capacity}</td>
                        <td className="muted nowrap">{dateTime(venue.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                total={data.total}
                limit={data.limit}
                offset={data.offset}
                basePath="/admin/venues"
              />
            </>
          ) : (
            <EmptyState iconName="pin" title="No venues yet" text="Add the first venue in the form on the left." />
          )}
        </div>
      </div>
    </>
  );
}
