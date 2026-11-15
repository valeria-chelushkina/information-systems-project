import { Link } from 'react-router-dom';
import { Icon } from '@/components/Icon';

export function Pagination({
  total,
  limit,
  offset,
  basePath,
  query,
}: {
  total: number;
  limit: number;
  offset: number;
  basePath: string;
  query?: Record<string, string | undefined>;
}) {
  if (total <= limit) {
    return null;
  }

  const page = Math.floor(offset / limit) + 1;
  const pages = Math.ceil(total / limit);

  const href = (nextOffset: number): string => {
    const params = new URLSearchParams();

    for (const [key, value] of Object.entries(query ?? {})) {
      if (value) {
        params.set(key, value);
      }
    }

    if (nextOffset > 0) {
      params.set('offset', String(nextOffset));
    }

    const search = params.toString();
    return search ? `${basePath}?${search}` : basePath;
  };

  return (
    <div className="pagination">
      {offset > 0 ? (
        <Link className="btn btn--ghost btn--sm" to={href(Math.max(offset - limit, 0))}>
          <Icon name="arrow" className="icon icon--sm icon--flip" />
          Previous
        </Link>
      ) : (
        <span className="btn btn--ghost btn--sm is-disabled">Previous</span>
      )}
      <span className="pagination__info">
        Page {page} of {pages}
      </span>
      {offset + limit < total ? (
        <Link className="btn btn--ghost btn--sm" to={href(offset + limit)}>
          Next
          <Icon name="arrow" className="icon icon--sm" />
        </Link>
      ) : (
        <span className="btn btn--ghost btn--sm is-disabled">Next</span>
      )}
    </div>
  );
}
