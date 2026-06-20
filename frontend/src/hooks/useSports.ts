import { useQuery } from '@tanstack/react-query';
import * as sportsApi from '../api/sports';
import { Sport } from '../types';

/**
 * Cached list of sports. Used by the event filters, create/edit forms, etc.
 * The list rarely changes, so it is cached aggressively.
 */
export function useSports(includeInactive = false) {
  return useQuery<Sport[]>({
    queryKey: ['sports', { includeInactive }],
    queryFn: async () => (await sportsApi.getAll(includeInactive)).data,
    staleTime: 5 * 60_000,
  });
}
