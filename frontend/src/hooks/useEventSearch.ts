import { keepPreviousData, useQuery } from '@tanstack/react-query';
import * as eventsApi from '../api/events';
import { EventSearchParams, EventSearchResponse } from '../types';

/**
 * Searches events with the given filter/sort/paging parameters. The params
 * object is part of the query key, so React Query caches each distinct filter
 * combination and refetches automatically when the filters change.
 * keepPreviousData avoids a flash of empty content while paging/filtering.
 */
export function useEventSearch(params: EventSearchParams) {
  return useQuery<EventSearchResponse>({
    queryKey: ['events', 'search', params],
    queryFn: async () => (await eventsApi.search(params)).data,
    placeholderData: keepPreviousData,
  });
}
