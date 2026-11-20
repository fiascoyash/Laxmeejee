import { queryOptions } from '@tanstack/react-query';
import { loadDirectoryIndex, searchDirectory } from './discovery.functions';
import type { DiscoveryFilters } from './discovery';

export const directoryQuery = (filters: DiscoveryFilters) => queryOptions({
  queryKey: ['public-directory', filters],
  queryFn: () => searchDirectory({ data: filters }),
  staleTime: 15_000,
});

/** Every published shop and product, searched in the browser so typing never waits on the network. */
export const directoryIndexQuery = () => queryOptions({
  queryKey: ['public-directory-index'],
  queryFn: () => loadDirectoryIndex(),
  staleTime: 60_000,
});
