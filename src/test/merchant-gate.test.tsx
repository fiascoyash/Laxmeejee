import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BusinessGate } from '@/components/tenant/BusinessGate';
import { useMerchantStore, useStoreConnection } from '@/components/tenant/store-context';

const mocks = vi.hoisted(() => ({
  listener: undefined as undefined | ((event: string, session: unknown) => void),
  getSession: vi.fn(), from: vi.fn(), signOut: vi.fn(),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {
  auth: {
    getSession: mocks.getSession,
    onAuthStateChange: (listener: typeof mocks.listener) => { mocks.listener = listener; return { data: { subscription: { unsubscribe: vi.fn() } } }; },
    signOut: mocks.signOut,
  },
  from: mocks.from,
  channel: () => { const ch: any = { on: () => ch, subscribe: () => ch }; return ch; },
  removeChannel: vi.fn(),
} }));
vi.mock('@/lib/cloud-sync', () => ({ startSync: vi.fn(async () => {}), stopSync: vi.fn(async () => {}) }));
vi.mock('@/components/tenant/AuthScreen', () => ({ AuthScreen: () => <div data-testid="account-form" /> }));
vi.mock('@/components/tenant/OnboardingForm', () => ({ OnboardingForm: () => <div data-testid="store-setup" /> }));
vi.mock('@/components/tenant/ShopSettings', () => ({ ShopSettings: () => null }));
vi.mock('@/components/tenant/PickupOrders', () => ({ PickupOrders: () => null }));

function Desk() {
  const connection = useStoreConnection();
  const store = useMerchantStore();
  return <><input aria-label="Local bill" defaultValue="INV-42" /><button onClick={connection?.openConnection}>Connect</button><output data-testid="store-access">{store ? 'connected' : 'local-only'}</output></>;
}
function mount() {
  render(<QueryClientProvider client={new QueryClient()}><BusinessGate><Desk /></BusinessGate></QueryClientProvider>);
}
afterEach(() => { cleanup(); vi.clearAllMocks(); sessionStorage.clear(); localStorage.clear(); });

describe('Merchant sign-in gate', () => {
  it('hides the billing desk while the account check is pending', () => {
    mocks.getSession.mockReturnValue(new Promise(() => {}));
    mount();
    expect(screen.queryByLabelText('Local bill')).not.toBeInTheDocument();
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('shows only the sign-in screen when signed out', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    mount();
    await act(async () => {});
    expect(screen.getByTestId('account-form')).toBeInTheDocument();
    expect(screen.queryByLabelText('Local bill')).not.toBeInTheDocument();
  });

  it('shows shop setup instead of billing for a signed-in merchant without a shop', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'owner-1' } } } });
    const query = { select: vi.fn(() => query), order: vi.fn(() => query), limit: vi.fn(() => query), maybeSingle: vi.fn(async () => ({ data: null, error: null })) };
    mocks.from.mockReturnValue(query);
    mount();
    await waitFor(() => expect(screen.getByTestId('store-setup')).toBeInTheDocument());
    expect(screen.queryByLabelText('Local bill')).not.toBeInTheDocument();
  });

  it('opens billing with the store connected once the merchant has a shop', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'owner-1' } } } });
    const shop = { id: 'b1', public_name: 'Sharma Hardware', slug: 'sharma', is_published: true };
    const query: any = { select: vi.fn(() => query), order: vi.fn(() => query), limit: vi.fn(() => query), eq: vi.fn(() => query), in: vi.fn(() => query),
      maybeSingle: vi.fn().mockResolvedValueOnce({ data: { business_id: 'b1' }, error: null }).mockResolvedValueOnce({ data: shop, error: null }),
      then: (r: (v: unknown) => void) => r({ data: [], count: 0, error: null }) };
    mocks.from.mockReturnValue(query);
    mount();
    await waitFor(() => expect(screen.getByTestId('store-access')).toHaveTextContent('connected'));
  });
});
