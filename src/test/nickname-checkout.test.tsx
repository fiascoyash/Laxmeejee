import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { PickupCheckout } from '@/components/tenant/PickupCart';
import { readSavedPickups } from '@/lib/saved-pickups';
const cloud = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: cloud }));
vi.mock('@tanstack/react-router', () => ({ Link: ({ children }: { children: React.ReactNode }) => <a href="/track">{children}</a> }));
beforeEach(() => {
  localStorage.clear(); cloud.rpc.mockResolvedValue({ data: 'ABCDEF', error: null });
  Element.prototype.scrollIntoView = vi.fn();
  window.matchMedia = vi.fn().mockReturnValue({ matches: true });
});
afterEach(cleanup);
it('places and saves the nickname with a code only after a successful order', async () => {
  const cart = { qty: { p1: 1 }, set: vi.fn(), clear: vi.fn() };
  const products = [{ product_id: 'p1', name: 'Switch', unit: 'pcs', price: 25, in_stock: true }];
  const { rerender } = render(<PickupCheckout slug="test-shop" products={products} cart={cart} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Order nickname' }), { target: { value: 'Chai Lover' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Mobile number' }), { target: { value: '9876543210' } });
  fireEvent.click(screen.getByRole('button', { name: 'Place pickup order' }));
  await waitFor(() => expect(cart.clear).toHaveBeenCalledOnce());
  expect(cloud.rpc).toHaveBeenCalledWith('place_pickup_order', expect.objectContaining({ _name: 'Chai Lover', _phone: '9876543210' }));
  expect(readSavedPickups()).toEqual([{ code: 'ABCDEF', phone: '9876543210', nickname: 'Chai Lover', slug: 'test-shop' }]);
  rerender(<PickupCheckout slug="test-shop" products={products} cart={{ ...cart, qty: {} }} />);
  expect(screen.getByRole('link', { name: 'Track Order' })).toBeInTheDocument();
});
it('never saves a pickup code when placing the order fails', async () => {
  cloud.rpc.mockResolvedValue({ data: null, error: { message: 'Shop not available' } });
  render(<PickupCheckout slug="test-shop" products={[{ product_id: 'p1', name: 'Switch', unit: null, price: 25, in_stock: true }]} cart={{ qty: { p1: 1 }, set: vi.fn(), clear: vi.fn() }} />);
  fireEvent.change(screen.getByRole('textbox', { name: 'Order nickname' }), { target: { value: 'Batman' } });
  fireEvent.change(screen.getByRole('textbox', { name: 'Mobile number' }), { target: { value: '9876543210' } });
  fireEvent.click(screen.getByRole('button', { name: 'Place pickup order' }));
  await screen.findByText('Shop not available');
  expect(readSavedPickups()).toEqual([]);
});