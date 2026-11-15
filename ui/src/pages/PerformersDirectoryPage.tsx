import { Link } from 'react-router-dom';
import { EmptyState, ErrorBox, PageLoader, SectionHead } from '@/components/UI';
import { errorMessage } from '@/helpers/format';
import { useApi } from '@/hooks/useApi';
import type { PerformerProfile } from '@/typedefs/catalog.typedefs';
import type { Paged } from '@/typedefs/common.typedefs';

export function PerformersDirectoryPage() {
  const { data, error, loading, reload } = useApi<Paged<PerformerProfile>>(
    '/public/performers?limit=100&offset=0',
  );

  const performers = data?.items ?? [];

  return (
    <>
      <section className="page-hero">
        <div className="container">
          <span className="eyebrow">Lineup</span>
          <h1>Performers</h1>
          <p>Every artist playing a Concert Ops event, with a short biography.</p>
        </div>
      </section>

      <section className="section section--tight">
        <div className="container">
          {loading ? (
            <PageLoader text="Loading performers…" />
          ) : error ? (
            <ErrorBox message={errorMessage(error.code)} onRetry={reload} />
          ) : performers.length === 0 ? (
            <EmptyState
              iconName="mic"
              title="No performers yet"
              text="Artists will appear here once the team adds them."
            />
          ) : (
            <>
              <SectionHead
                eyebrow="Artists"
                title={`${performers.length} in the catalogue`}
              />
              <div className="performer-grid">
                {performers.map((performer) => (
                  <article className="performer-card" key={performer.id}>
                    <span className="performer-card__genre">
                      {performer.genre ?? 'Artist'}
                    </span>
                    <h2>
                      <Link to={`/performers/${performer.id}`}>{performer.name}</Link>
                    </h2>
                    <p className="performer-card__bio">
                      {performer.bio ?? 'Biography coming soon.'}
                    </p>
                    <Link
                      className="link performer-card__link"
                      to={`/performers/${performer.id}`}
                    >
                      View profile
                    </Link>
                  </article>
                ))}
              </div>
            </>
          )}
        </div>
      </section>
    </>
  );
}
