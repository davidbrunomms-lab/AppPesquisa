import { useQuery, useQueryClient, type QueryKey } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { api, type Query } from '@/lib/api';

/** GET tipado com React Query. `path` nulo desabilita a consulta. */
export function useApi<T>(key: QueryKey, path: string | null, query?: Query, options: { enabled?: boolean; refetchInterval?: number } = {}) {
  return useQuery<T>({
    queryKey: key,
    queryFn: () => api.get<T>(path as string, query),
    enabled: !!path && (options.enabled ?? true),
    refetchInterval: options.refetchInterval,
  });
}

/** Pull-to-refresh: refaz as consultas informadas. */
export function useRefresh(...refetchers: (() => Promise<unknown>)[]) {
  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all(refetchers.map((r) => r()));
    } finally {
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, refetchers);
  return { refreshing, onRefresh };
}

export function useInvalidate() {
  const qc = useQueryClient();
  return useCallback((...keys: QueryKey[]) => Promise.all(keys.map((k) => qc.invalidateQueries({ queryKey: k }))), [qc]);
}
