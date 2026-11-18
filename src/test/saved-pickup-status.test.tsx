import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { SavedPickupOrders } from '@/components/tenant/SavedPickupOrders';
import { readSavedPickups, savePickup } from '@/lib/saved-pickups';
const cloud = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: cloud }));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a href="/track">{children}</a> }));
const order = { code: 'ABCDEF', phone: '9876543210', nickname: 'Batman', slug: 'test-shop' };
beforeEach(() => { localStorage.clear(); vi.clearAllMocks(); savePickup(order); });
afterEach(cleanup);
it.each(['collected', 'cancelled'])('removes saved codes only when the order is %s', async status => {
  cloud.rpc.mockResolvedValue({ data: { status }, error: null });
  render(<SavedPickupOrders />);
  await waitFor(() => expect(readSavedPickups()).toEqual([]));
});
it.each(['new', 'accepted', 'ready'])('retains the saved code for an active %s order', async status => {
  cloud.rpc.mockResolvedValue({ data: { status }, error: null });
  render(<SavedPickupOrders />);
  await screen.findByText(/#ABCDEF/);
  expect(readSavedPickups()).toEqual([order]);
});
it('does not lose a saved code when the connection fails', async () => {
  cloud.rpc.mockRejectedValue(new Error('offline'));
  render(<SavedPickupOrders />);
  await screen.findByText(/#ABCDEF/);
  expect(readSavedPickups()).toEqual([order]);
});