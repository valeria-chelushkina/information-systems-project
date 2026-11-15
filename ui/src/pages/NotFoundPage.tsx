import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';

export function NotFoundPage() {
  return (
    <section className="section section--top">
      <div className="container narrow">
        <div className="error-page">
          <span className="error-page__code">404</span>
          <h1>Page not found</h1>
          <p>The address does not exist or the page has moved.</p>
          <div className="error-page__actions">
            <Link className="btn btn--primary" to="/">
              Go home <Icon name="arrow" className="icon icon--sm" />
            </Link>
            <Link className="btn btn--ghost" to="/events">
              Browse events
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
