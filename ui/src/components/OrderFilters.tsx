import { useEffect, useState, type FormEvent } from 'react';
import { useApi } from '@/hooks/useApi';
import type { PerformerOption } from '@/typedefs/catalog.typedefs';
import type { OrderFiltersProps } from '@/typedefs/ui.typedefs';

export function OrderFilters({ initial, onSubmit, onReset }: OrderFiltersProps) {
  const [performerId, setPerformerId] = useState(initial.performerId);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const performers = useApi<PerformerOption[]>('/orders/performers');

  useEffect(() => {
    setPerformerId(initial.performerId);
    setFrom(initial.from);
    setTo(initial.to);
  }, [initial.performerId, initial.from, initial.to]);

  const hasFilters = Boolean(initial.performerId || initial.from || initial.to);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    onSubmit({ performerId, from, to });
  };

  const reset = () => {
    setPerformerId('');
    setFrom('');
    setTo('');
    onReset();
  };

  return (
    <form className="filters filters--orders" onSubmit={submit}>
      <label className="field">
        <span className="field__label">Performer</span>
        <select
          className="select"
          value={performerId}
          onChange={(event) => setPerformerId(event.target.value)}
        >
          <option value="">All performers</option>
          {(performers.data ?? []).map((performer) => (
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
