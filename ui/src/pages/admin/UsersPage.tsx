import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Pagination } from '@/components/Pagination';
import { ErrorBox, PageLoader, StatusBadge } from '@/components/UI';
import { useToast } from '@/hooks/useToast';
import { api, ApiError } from '@/helpers/api';
import { errorMessage, shortDateTime } from '@/helpers/format';
import { useApi } from '@/hooks/useApi';
import type { AdminUser, TeamRole } from '@/typedefs/admin.typedefs';
import type { Paged } from '@/typedefs/common.typedefs';
import { ADMIN_PAGE_SIZE } from '@/constants/pagination.constants';

export function UsersPage() {
  const { push } = useToast();
  const [params] = useSearchParams();
  const parsedOffset = Number(params.get('offset') ?? '0');
  const offset = Number.isFinite(parsedOffset) && parsedOffset > 0 ? Math.floor(parsedOffset) : 0;
  const { data, error, loading, reload } = useApi<Paged<AdminUser>>(
    `/admin/users?limit=${ADMIN_PAGE_SIZE}&offset=${offset}`,
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<TeamRole>('staff');
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    try {
      await api.post('/admin/users', { email, password, role });
      push('Team member created.');
      setEmail('');
      setPassword('');
      setRole('staff');
      reload();
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
          <span className="eyebrow">Access</span>
          <h1>Team</h1>
          <p className="page-head__sub">
            Manage who can access the control panel. Customers register on the public site.
          </p>
        </div>
      </div>
      <div className="split">
        <div className="panel">
          <div className="panel__head">
            <h2>New team member</h2>
          </div>
          <form className="form" onSubmit={submit}>
            <label className="field">
              <span className="field__label">Email</span>
              <input className="input" type="email" value={email} placeholder="manager@example.com" onChange={(event) => setEmail(event.target.value)} required />
            </label>
            <label className="field">
              <span className="field__label">Password</span>
              <input className="input" type="password" value={password} minLength={8} maxLength={200} placeholder="At least 8 characters" onChange={(event) => setPassword(event.target.value)} required />
            </label>
            <label className="field">
              <span className="field__label">Role</span>
              <select className="select" value={role} onChange={(event) => setRole(event.target.value as TeamRole)}>
                <option value="staff">Staff</option>
                <option value="admin">Administrator</option>
              </select>
            </label>
            <div className="form-actions">
              <button className="btn btn--primary" type="submit" disabled={busy}>
                Create
              </button>
            </div>
          </form>
          <p className="form__hint">
            Admins manage the team and all data; staff run events, bookings and sales.
          </p>
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
                      <th>Email</th>
                      <th>Role</th>
                      <th>State</th>
                      <th>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.items.map((account) => (
                      <tr key={account.id}>
                        <td>
                          <strong>{account.email}</strong>
                        </td>
                        <td>
                          <StatusBadge status={account.role} />
                        </td>
                        <td>
                          <span className={`badge badge--${account.isActive ? 'ok' : 'muted'}`}>
                            {account.isActive ? 'Active' : 'Disabled'}
                          </span>
                        </td>
                        <td className="muted nowrap">{shortDateTime(account.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                total={data.total}
                limit={data.limit}
                offset={data.offset}
                basePath="/admin/users"
              />
            </>
          ) : (
            <p className="muted">No team members yet.</p>
          )}
        </div>
      </div>
    </>
  );
}
