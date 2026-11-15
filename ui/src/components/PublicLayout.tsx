import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Icon } from '@/components/Icon';
import { ThemeToggle } from '@/components/ThemeToggle';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';

const LINKS = [{ href: '/events', label: 'Events' }];

function initials(email: string): string {
  return email.slice(0, 1).toUpperCase();
}

export function PublicLayout() {
  const { user, logout } = useAuth();
  const { push } = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);

    if (location.hash) {
      const target = document.querySelector(location.hash);

      if (target) {
        window.requestAnimationFrame(() => target.scrollIntoView({ behavior: 'smooth' }));
      }
    } else {
      window.scrollTo({ top: 0 });
    }
  }, [location.pathname, location.hash, location.key]);

  const onLogout = async () => {
    await logout();
    push('Signed out.');
    navigate('/');
  };

  const isLoginPage = location.pathname === '/login';

  return (
    <div className="theme-public">
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className={`site-header${open ? ' is-open' : ''}`}>
        <Link className="brand" to="/" aria-label="Concert Ops — home">
          <span className="brand__text">
            Concert<span>Ops</span>
          </span>
        </Link>
        <nav className="site-nav" id="site-nav">
          {LINKS.map((link) =>
            link.href.startsWith('/#') ? (
              <a key={link.href} className="nav-link" href={link.href}>
                {link.label}
              </a>
            ) : (
              <NavLink
                key={link.href}
                className={({ isActive }) => `nav-link${isActive ? ' is-active' : ''}`}
                to={link.href}
              >
                {link.label}
              </NavLink>
            ),
          )}
        </nav>
        <div className="site-header__actions">
          <ThemeToggle />
          {isLoginPage ? null : user ? (
            <>
              {user.role === 'admin' || user.role === 'staff' ? (
                <>
                  <Link className="btn btn--ghost btn--sm" to="/admin">
                    <Icon name="chart" className="icon icon--sm" />
                    Panel
                  </Link>
                  <Link className="icon-btn" to="/profile" aria-label="My profile" title="My profile">
                    <Icon name="users" />
                  </Link>
                </>
              ) : (
                <Link className="site-user" to="/profile" title="My profile">
                  <span className="avatar avatar--sm">{initials(user.email)}</span>
                  {user.email}
                </Link>
              )}
              <button className="icon-btn" type="button" onClick={onLogout} aria-label="Sign out" title="Sign out">
                <Icon name="logout" />
              </button>
            </>
          ) : (
            <Link className="btn btn--primary btn--sm" to="/login">
              <Icon name="arrow" className="icon icon--sm" />
              Sign in
            </Link>
          )}
          <button
            className="icon-btn nav-toggle"
            type="button"
            aria-label="Menu"
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            <Icon name={open ? 'close' : 'menu'} />
          </button>
        </div>
      </header>
      <main id="main">
        <Outlet />
      </main>
      <footer className="site-footer">
        <div className="site-footer__grid">
          <div>
            <Link className="brand brand--footer" to="/">
              <span className="brand__text">
                Concert<span>Ops</span>
              </span>
            </Link>
            <p className="site-footer__text">
              Concert operations platform with a full observability stack.
            </p>
          </div>
          <div className="site-footer__links">
            <Link to="/events">Events</Link>
          </div>
          <div className="site-footer__meta">
            <span>{new Date().getFullYear()} © Concert Ops</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
