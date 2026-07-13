import { useCallback, useEffect, useState } from 'react';
import { api } from './api';

/** Increments whenever the main process reports data changed. */
export function useDataVersion(): number {
  const [version, setVersion] = useState(0);
  useEffect(
    () => api.onDataChanged(() => setVersion((current) => current + 1)),
    [],
  );
  return version;
}

/** Fetches async data, refetching whenever `deps` change. */
export function useAsyncData<T>(
  fetcher: () => Promise<T>,
  deps: readonly unknown[],
): { data: T | null; reload: () => void } {
  const [data, setData] = useState<T | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetcher().then((result) => {
      if (!cancelled) {
        setData(result);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadToken]);

  const reload = useCallback(() => setReloadToken((current) => current + 1), []);
  return { data, reload };
}

/** A Date that refreshes on an interval, for relative timestamps. */
export function useNow(intervalMs = 30_000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), intervalMs);
    return () => clearInterval(interval);
  }, [intervalMs]);
  return now;
}
