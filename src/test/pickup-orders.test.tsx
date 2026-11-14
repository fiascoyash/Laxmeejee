import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PickupOrders } from '@/components/tenant/PickupOrders';

const cloud = vi.hoisted(() => ({ from: vi.fn(), update: vi.fn(), filters: vi.fn(), result: { data: [{ id: 'order-1' }], error: null } as { data: { id: string }[] | null; error: unknown } }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { from: cloud.from } }));

const order = {
  id: 'order-1', business_id: 'shop-1', order_code: 'ABCDEF', customer_name: 'Test Customer',
  customer_phone: '9876543210', status: 'collected', total: 500, note: null,
  items: [{ product_id: 'product-1', name: 'Switch', qty: 2, price: 250, unit: 'pcs' }],
  created_at: '2026-11-12T10:00:00Z', updated_at: '2026-11-12T10:00:00Z',
};

beforeEach(() => {
  vi.clearAllMocks();
  cloud.result = { data: [{ id: order.id }], error: null };
  cloud.from.mockImplementation(() => ({
    select: () => ({ eq: () => ({ order: () => ({ limit: async () => ({ data: [order] }) }) }) }),
    update: (values: unknown) => {
      cloud.update(values);
      const chain = { eq: (key: string, value: string) => { cloud.filters(key, value); return chain; }, select: async () => cloud.result };
      return chain;
    },
  }));
});
afterEach(cleanup);

async function showCompleted(onClose = vi.fn()) {
  render(<PickupOrders businessId="shop-1" onClose={onClose} />);
  fireEvent.click(screen.getByRole('checkbox', { name: 'Show completed' }));
  await screen.findByText(/#ABCDEF/);
}

describe('Collected-order recovery', () => {
  it('opens the existing invoice flow with the full collected order without changing its status', async () => {
    const received = vi.fn();
    const close = vi.fn();
    window.addEventListener('hisaaboo:bill-from-order', received);
    try {
      await showCompleted(close);
      fireEvent.click(screen.getByRole('button', { name: 'Generate GST bill' }));
      expect(received).toHaveBeenCalledTimes(1);
      expect((received.mock.calls[0]?.[0] as CustomEvent | undefined)?.detail).toEqual(order);
      expect(close).toHaveBeenCalledTimes(1);
      expect(cloud.update).not.toHaveBeenCalled();
    } finally { window.removeEventListener('hisaaboo:bill-from-order', received); }
  });

  it('reopens a collected order to ready, scoped to its shop and previous status', async () => {
    await showCompleted();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen order' }));
    await waitFor(() => expect(cloud.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'ready' })));
    expect(cloud.filters).toHaveBeenCalledWith('id', 'order-1');
    expect(cloud.filters).toHaveBeenCalledWith('business_id', 'shop-1');
    expect(cloud.filters).toHaveBeenCalledWith('status', 'collected');
  });

  it.each([
    { data: null, error: { message: 'denied' } },
    { data: [], error: null },
  ])('does not report success when reopening fails or updates no rows', async result => {
    cloud.result = result;
    await showCompleted();
    fireEvent.click(screen.getByRole('button', { name: 'Reopen order' }));
    await screen.findByRole('alert');
    expect(screen.getByText('Collected')).toBeInTheDocument();
    expect(cloud.from).toHaveBeenCalledTimes(2);
  });
});