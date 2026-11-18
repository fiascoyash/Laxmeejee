import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';

const directory = vi.hoisted(() => ({ load: vi.fn() }));

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: () => (options: Record<string, unknown>) => ({
    ...options,
    useSearch: () => ({ q: '', city: '', locality: '', category: '', page: 1 }),
    useNavigate: () => vi.fn(),
    useLoaderData: () => null,
  }),
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('@/lib/discovery.queries', () => ({
  directoryQuery: () => ({ queryKey: ['test-directory'], queryFn: directory.load, staleTime: 0 }),
}));
vi.mock('@/legacy/components/LandingPage', () => ({
  LandingPage: ({ heroSearch, directory: results }: { heroSearch: ReactNode; directory: ReactNode }) => <main><h1>Your local market, connected.</h1>{heroSearch}{results}</main>,
}));
vi.mock('@/lib/billing-navigation', () => ({ legacyBillingView: () => null }));
vi.mock('@/components/tenant/PickupCart', () => ({ useCart: vi.fn(), QtyControl: () => null, PickupCheckout: () => null }));
vi.mock('@/components/tenant/ResponseBadge', () => ({ ResponseBadge: () => null }));
vi.mock('@/components/tenant/SavedPickupOrders', () => ({ SavedPickupOrders: () => null }));

import { Index } from '@/routes/index';

beforeEach(() => {
  directory.load.mockReset();
  directory.load.mockRejectedValue(new Error('Directory offline'));
});
afterEach(cleanup);

function renderHomepage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={queryClient}><Index /></QueryClientProvider>);
}

it('keeps the complete homepage visible when shop search fails and retries only the directory', async () => {
  renderHomepage();
  expect(screen.getByRole('heading', { name: 'Your local market, connected.' })).toBeInTheDocument();
  expect(screen.getByRole('textbox', { name: 'Search shops or products' })).toBeInTheDocument();
  expect(await screen.findByRole('alert', {}, { timeout: 3000 })).toHaveTextContent('Shop search couldn’t load');
  expect(screen.getByRole('heading', { name: 'Your local market, connected.' })).toBeInTheDocument();

  const callsBeforeRetry = directory.load.mock.calls.length;
  directory.load.mockResolvedValue({ shops: [], total: 0, page: 1, pages: 1, cities: [], localities: [], categories: [] });
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No matching shops')).toBeInTheDocument();
  await waitFor(() => expect(directory.load).toHaveBeenCalledTimes(callsBeforeRetry + 1));
  expect(screen.getByRole('heading', { name: 'Your local market, connected.' })).toBeInTheDocument();
});
