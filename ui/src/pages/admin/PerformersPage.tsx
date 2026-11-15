import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pagination } from '@/components/Pagination';
import { EmptyState, ErrorBox, PageLoader } from '@/components/UI';
import { useToast } from '@/hooks/useToast';
import { api, ApiError } from '@/helpers/api';
import { dateTime, errorMessage } from '@/helpers/format';
import { useApi } from '@/hooks/useApi';
import type { Paged } from '@/typedefs/common.typedefs';
import type { Performer } from '@/typedefs/catalog.typedefs';
import { ADMIN_PAGE_SIZE } from '@/constants/pagination.constants';

export function PerformersPage() {
  const { push } = useToast();
  const [params] = useSearchParams();
  const parsedOffset = Number(params.get('offset') ?? '0');
  const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? Math.floor(parsedOffset) : 0;
  const { data, error, loading, reload } = useApi<Paged<Performer>>(
    `/admin/performers?limit=${ADMIN_PAGE_SIZE}&offset=${offset}`,
  );
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('');
  const [bio, setBio] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const resetForm = () => {
    setName('');
    setGenre('');
    setBio('');
    setContactEmail('');
    setEditingId(null);
  };

  const startEdit = (performer: Performer) => {
    setEditingId(performer.id);
    setName(performer.name);
    setGenre(performer.genre ?? '');
    setBio(performer.bio ?? '');
    setContactEmail(performer.contactEmail ?? '');
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);

    const payload = {
      name,
      genre: genre || null,
      bio: bio || null,
      contactEmail: contactEmail || null,
    };

    try {
      if (editingId) {
        await api.patch(`/admin/performers/${editingId}`, payload);
        push('Performer updated.');
      } else {
        await api.post('/admin/performers', {
          name,
          ...(genre ? { genre } : {}),
          ...(bio ? { bio } : {}),
          ...(contactEmail ? { contactEmail } : {}),
        });
        push('Performer added.');
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
          <h1>Performers</h1>
          <p className="page-head__sub">
            Used when creating events. The name is stored on the event as a snapshot.
          </p>
        </div>
      </div>
      <div className="split">
        <div className="panel">
          <div className="panel__head">
            <h2>{editingId ? 'Edit performer' : 'Add performer'}</h2>
          </div>
          <form className="form" onSubmit={submit}>
            <label className="field">
              <span className="field__label">Name</span>
              <input className="input" value={name} maxLength={160} placeholder="Nova Wave" onChange={(event) => setName(event.target.value)} required />
            </label>
            <div className="form-grid">
              <label className="field">
                <span className="field__label">Genre</span>
                <input className="input" value={genre} maxLength={80} placeholder="synthpop" onChange={(event) => setGenre(event.target.value)} />
              </label>
              <label className="field">
                <span className="field__label">Email</span>
                <input className="input" type="email" value={contactEmail} placeholder="booking@example.com" onChange={(event) => setContactEmail(event.target.value)} />
              </label>
            </div>
            <label className="field">
              <span className="field__label">Bio (optional)</span>
              <textarea
                className="input"
                rows={3}
                maxLength={2000}
                value={bio}
                placeholder="Short artist biography shown on the public event page"
                onChange={(event) => setBio(event.target.value)}
              />
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
                      <th>Genre</th>
                      <th>Email</th>
                      <th>Added</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((performer) => (
                      <tr key={performer.id}>
                        <td>
                          <strong>{performer.name}</strong>
                        </td>
                        <td>{performer.genre ?? <span className="muted">вЂ”</span>}</td>
                        <td>{performer.contactEmail ?? <span className="muted">вЂ”</span>}</td>
                        <td className="muted nowrap">{dateTime(performer.createdAt)}</td>
                        <td className="nowrap">
                          <button className="btn btn--ghost btn--xs" type="button" onClick={() => startEdit(performer)}>
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
                basePath="/admin/performers"
              />
            </>
          ) : (
            <EmptyState iconName="mic" title="No performers yet" text="Add the first performer in the form on the left." />
          )}
        </div>
      </div>
    </>
  );
}
