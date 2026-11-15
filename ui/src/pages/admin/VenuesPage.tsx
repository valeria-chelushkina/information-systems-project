import { useState, type FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorBox, PageLoader } from '@/components/UI';
import { useToast } from '@/hooks/useToast';
import { api, ApiError } from '@/helpers/api';
import { dateTime, errorMessage } from '@/helpers/format';
import { useApi } from '@/hooks/useApi';
import type { Paged } from '@/typedefs/common.typedefs';
import type { Venue } from '@/typedefs/catalog.typedefs';
import { CATALOG_PAGE_SIZE } from '@/constants/pagination.constants';

export function VenuesPage() {
  const { push } = useToast();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const parsedOffset = Number(params.get('offset') ?? '0');
  const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? Math.floor(parsedOffset) : 0;
  const search = params.get('search') ?? '';
  const query = new URLSearchParams({
    limit: String(CATALOG_PAGE_SIZE),
    offset: String(offset),
  });

  if (search) query.set('search', search);

  const { data, error, loading, reload } = useApi<Paged<Venue>>(
    `/admin/venues?${query.toString()}`,
  );
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [timezone, setTimezone] = useState('Europe/Kyiv');
  const [capacity, setCapacity] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setName('');
    setCity('');
    setTimezone('Europe/Kyiv');
    setCapacity('');
    setEditingId(null);
  };

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = String(new FormData(event.currentTarget).get('search') ?? '').trim();
    navigate(value ? `/admin/venues?search=${encodeURIComponent(value)}` : '/admin/venues');
  };

  const startEdit = (venue: Venue) => {
    setEditingId(venue.id);
    setName(venue.name);
    setCity(venue.city);
    setTimezone(venue.timezone);
    setCapacity(String(venue.capacity));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);

    const payload = { name, city, timezone, capacity: Number(capacity) };

    try {
      if (editingId) {
        await api.patch(`/admin/venues/${editingId}`, payload);
        push('Venue updated.');
      } else {
        await api.post('/admin/venues', payload);
        push('Venue added.');
      }

      resetForm();
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
      <div className="catalog-layout">
        <div className="panel">
          <div className="panel__head">
            <h2>{editingId ? 'Edit venue' : 'Add venue'}</h2>
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
                {editingId ? 'Save changes' : 'Add'}
              </button>
              {editingId ? (
                <button className="btn btn--ghost" type="button" onClick={resetForm}>
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
        </div>
        <div className="panel">
          <div className="panel__head">
            <h2>Total: {data?.total ?? 0}</h2>
          </div>
          <form className="filters filters--search" onSubmit={applySearch}>
            <label className="field">
              <span className="field__label">Search</span>
              <input
                className="input"
                name="search"
                defaultValue={search}
                placeholder="Search by name"
              />
            </label>
            <div className="filters__actions">
              <button className="btn btn--primary" type="submit">
                Search
              </button>
              {search ? (
                <button
                  className="btn btn--ghost"
                  type="button"
                  onClick={() => navigate('/admin/venues')}
                >
                  Reset
                </button>
              ) : null}
            </div>
          </form>
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
                      <th />
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
                        <td className="nowrap">
                          <button className="btn btn--ghost btn--xs" type="button" onClick={() => startEdit(venue)}>
                            Change
                          </button>
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
                basePath="/admin/venues"
                query={{ search }}
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
