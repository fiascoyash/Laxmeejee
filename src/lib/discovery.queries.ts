import { queryOptions } from '@tanstack/react-query';
import { searchDirectory } from './discovery.functions';
import type { DiscoveryFilters } from './discovery';

export const directoryQuery = (filters: DiscoveryFilters) => queryOptions({
  queryKey: ['public-directory', filters],
  queryFn: () => searchDirectory({ data: filters }),
  staleTime: 15_000,
});