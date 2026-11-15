import { useCallback, useEffect, useState } from 'react';
import { ApiError, api } from '@/helpers/api';

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(path !== null);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!path) {
      setData(null);
      setError(null);
      setLoading(false);
      return;
    }

    let active = true;
    setLoading(true);

    api
      .get<T>(path)
      .then((payload) => {
        if (active) {
          setData(payload);
          setError(null);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setError(
            caught instanceof ApiError ? caught : new ApiError(0, 'unknown', 'Unknown error'),
          );
          setData(null);
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [path, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  return { data, error, loading, reload };
}
