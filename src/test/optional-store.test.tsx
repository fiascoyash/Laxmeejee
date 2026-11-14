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
} }));
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

describe('Optional store connection', () => {
  it('allows billing while account lookup is pending without any cloud store access', () => {
    mocks.getSession.mockReturnValue(new Promise(() => {}));
    mount();
    fireEvent.change(screen.getByLabelText('Local bill'), { target: { value: 'INV-43' } });
    expect(screen.getByLabelText('Local bill')).toHaveValue('INV-43');
    expect(screen.getByTestId('store-access')).toHaveTextContent('local-only');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('requires explicit store connection when signed out and preserves billing when dismissed', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: null } });
    localStorage.setItem('solar_invoices', '[{"invoiceNumber":"INV-42"}]');
    mount();
    await act(async () => {});
    expect(screen.queryByTestId('account-form')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Connect'));
    expect(screen.getByTestId('account-form')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue billing' }));
    expect(screen.queryByTestId('account-form')).not.toBeInTheDocument();
    expect(screen.getByLabelText('Local bill')).toHaveValue('INV-42');
    expect(localStorage.getItem('solar_invoices')).toBe('[{"invoiceNumber":"INV-42"}]');
    expect(mocks.from).not.toHaveBeenCalled();
  });

  it('keeps billing accessible for a signed-in owner who has not created a store', async () => {
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'owner-1' } } } });
    const query = { select: vi.fn(() => query), order: vi.fn(() => query), limit: vi.fn(() => query), maybeSingle: vi.fn(async () => ({ data: null, error: null })) };
    mocks.from.mockReturnValue(query);
    mount();
    await waitFor(() => expect(query.maybeSingle).toHaveBeenCalledTimes(1));
    expect(screen.queryByTestId('store-setup')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Connect'));
    expect(screen.getByTestId('store-setup')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Continue billing' }));
    expect(screen.getByLabelText('Local bill')).toHaveValue('INV-42');
  });
});