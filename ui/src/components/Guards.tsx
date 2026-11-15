import { Link, Navigate, useLocation } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { PageLoader } from '@/components/UI';
import { isStaff } from '@/helpers/user';
import { useAuth } from '@/hooks/useAuth';
import type { ChildrenProps, ForbiddenProps } from '@/typedefs/ui.typedefs';

export function RequireAuth({ children }: ChildrenProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  return <>{children}</>;
}

export function RequireStaff({ children }: ChildrenProps) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }

  if (!isStaff(user)) {
    return <Forbidden standalone />;
  }

  return <>{children}</>;
}

export function RequireAdmin({ children }: ChildrenProps) {
  const { user, loading } = useAuth();

  if (loading) {
    return <PageLoader />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== 'admin') {
    return <Forbidden />;
  }

  return <>{children}</>;
}

export function Forbidden({ standalone = false }: ForbiddenProps) {
  return (
    <div className={`forbidden${standalone ? ' forbidden--standalone theme-public' : ''}`}>
      <section className="section section--top">
        <div className="container narrow">
          <div className="error-page">
            <span className="error-page__code">403</span>
            <h1>Access denied</h1>
            <p>This section is available to staff and administrators only.</p>
            <div className="error-page__actions">
              <Link className="btn btn--primary" to="/events">
                Browse events <Icon name="arrow" className="icon icon--sm" />
              </Link>
              <Link className="btn btn--ghost" to="/">
                Go home
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
