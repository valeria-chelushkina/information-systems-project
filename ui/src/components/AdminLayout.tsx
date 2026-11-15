import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/useToast';
import { ADMIN_NAV_LINKS } from '@/constants/navigation.constants';
import { GRAFANA_URL, PROMETHEUS_URL, RABBITMQ_URL, TRACES_URL } from '@/constants/links.constants';
import { initials } from '@/helpers/user';

export function AdminLayout() {
  const { user, logout } = useAuth();
  const { push } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  const onLogout = async () => {
    await logout();
    push('Signed out.');
    navigate('/');
  };

  if (!user) {
    return null;
  }

  return (
    <div className="theme-admin">
      <div className={`admin-shell${open ? ' sidebar-open' : ''}`}>
        <aside className="sidebar">
          <Link className="brand brand--side" to="/admin">
            <span className="brand__text">
              Concert<span>Ops</span>
            </span>
          </Link>
          <p className="sidebar__label">Management</p>
          <nav className="side-nav">
            {ADMIN_NAV_LINKS.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                end={link.end}
                className={({ isActive }) => `side-link${isActive ? ' is-active' : ''}`}
              >
                <Icon name={link.iconName} className="side-link__icon" />
                <span>{link.label}</span>
              </NavLink>
            ))}
            {user.role === 'admin' ? (
              <NavLink
                to="/admin/users"
                className={({ isActive }) => `side-link${isActive ? ' is-active' : ''}`}
              >
                <Icon name="users" className="side-link__icon" />
                <span>Team</span>
              </NavLink>
            ) : null}
          </nav>
          <p className="sidebar__label">System</p>
          <nav className="side-nav">
            <NavLink
              to="/profile"
              className={({ isActive }) => `side-link${isActive ? ' is-active' : ''}`}
            >
              <Icon name="users" className="side-link__icon" />
              <span>My profile</span>
            </NavLink>
            <a className="side-link" href={GRAFANA_URL} target="_blank" rel="noreferrer">
              <Icon name="chart" className="side-link__icon" />
              <span>Grafana</span>
              <Icon name="external" className="side-link__out" />
            </a>
            <a className="side-link" href={TRACES_URL} target="_blank" rel="noreferrer">
              <Icon name="route" className="side-link__icon" />
              <span>Traces</span>
              <Icon name="external" className="side-link__out" />
            </a>
            <a className="side-link" href={PROMETHEUS_URL} target="_blank" rel="noreferrer">
              <Icon name="pulse" className="side-link__icon" />
              <span>Prometheus</span>
              <Icon name="external" className="side-link__out" />
            </a>
            <a className="side-link" href={RABBITMQ_URL} target="_blank" rel="noreferrer">
              <Icon name="inbox" className="side-link__icon" />
              <span>RabbitMQ</span>
              <Icon name="external" className="side-link__out" />
            </a>
          </nav>
          <div className="sidebar__user">
            <span className="avatar">{initials(user.email)}</span>
            <span className="sidebar__user-text">
              <strong>{user.email}</strong>
              <span>{user.role === 'admin' ? 'Administrator' : 'Staff'}</span>
            </span>
            <button className="icon-btn" type="button" onClick={onLogout} aria-label="Sign out" title="Sign out">
              <Icon name="logout" />
            </button>
          </div>
        </aside>
        <div className="admin-main">
          <header className="topbar">
            <button
              className="icon-btn nav-toggle"
              type="button"
              aria-label="Menu"
              aria-expanded={open}
              onClick={() => setOpen((value) => !value)}
            >
              <Icon name={open ? 'close' : 'menu'} />
            </button>
            <span className="topbar__crumb">
              Concert Ops <span>/</span> Control panel
            </span>
            <div className="topbar__actions">
              <ThemeToggle />
              <Link className="btn btn--ghost btn--sm" to="/" target="_blank" rel="noreferrer">
                <Icon name="external" className="icon icon--sm" />View site
              </Link>
            </div>
          </header>
          <main className="admin-content" id="main">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
