import { useEffect, useState, type FormEvent } from 'react';
import { Icon } from '@/components/Icon';
import { useApi } from '@/lib/useApi';
import type { Paged, PerformerOption } from '@/lib/types';

export interface PublicFilterState {
  search: string;
  performerId: string;
  from: string;
  to: string;
}

export function EventFilters({
  initial,
  onSubmit,
  onReset,
}: {
  initial: PublicFilterState;
  onSubmit: (filters: PublicFilterState) => void;
  onReset: () => void;
}) {
  const [search, setSearch] = useState(initial.search);
  const [performerId, setPerformerId] = useState(initial.performerId);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const performers = useApi<Paged<PerformerOption>>('/public/performers?limit=100&offset=0');

  useEffect(() => {
    setSearch(initial.search);
    setPerformerId(initial.performerId);
    setFrom(initial.from);
    setTo(initial.to);
  }, [initial.search, initial.performerId, initial.from, initial.to]);

  const hasFilters = Boolean(initial.search || initial.performerId || initial.from || initial.to);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({
      search: search.trim(),
      performerId,
      from,
      to,
    });
  };

  const reset = () => {
    setSearch('');
    setPerformerId('');
    setFrom('');
    setTo('');
    onReset();
  };

  return (
    <form className="filters" onSubmit={submit}>
      <label className="field field--grow">
        <span className="field__label">Search</span>
        <input
          className="input"
          value={search}
          placeholder="Event, performer or venue"
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">Performer</span>
        <select
          className="select"
          value={performerId}
          onChange={(event) => setPerformerId(event.target.value)}
        >
          <option value="">All performers</option>
          {(performers.data?.items ?? []).map((performer) => (
            <option key={performer.id} value={performer.id}>
              {performer.name}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span className="field__label">From date</span>
        <input
          className="input"
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
      </label>
      <label className="field">
        <span className="field__label">To date</span>
        <input
          className="input"
          type="date"
          value={to}
          onChange={(event) => setTo(event.target.value)}
        />
      </label>
      <div className="filters__actions">
        <button className="btn btn--primary" type="submit">
          <Icon name="search" className="icon icon--sm" />
          Apply
        </button>
        {hasFilters ? (
          <button className="btn btn--ghost" type="button" onClick={reset}>
            Reset
          </button>
        ) : null}
      </div>
    </form>
  );
}
