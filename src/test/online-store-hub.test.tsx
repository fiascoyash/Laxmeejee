import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { OnlineStoreHub } from '@/components/tenant/OnlineStoreHub';
import { MerchantStoreProvider, type MerchantStoreContextValue } from '@/components/tenant/store-context';

const order: MerchantStoreContextValue['recentOrders'][number] = {
  id: 'order-1',
  business_id: 'shop-1',
  order_code: 'PICK42',
  customer_name: 'Asha',
  customer_phone: '9876543210',
  note: null,
  items: [{ product_id: 'product-1', name: 'Switch', qty: 2, price: 125, unit: 'pcs' }],
  total: 250,
  status: 'accepted',
  created_at: '2026-11-13T04:00:00Z',
  updated_at: '2026-11-13T04:00:00Z',
};

function setup(overrides: Partial<MerchantStoreContextValue> = {}) {
  const value: MerchantStoreContextValue = {
    business: {
      id: 'shop-1', slug: 'asha-electricals', public_name: 'Asha Electricals', is_published: true,
      category: 'Electricals', city: 'Bijnor', locality: 'Main Market', address: null,
      phone: null, hours: null, tagline: null,
    },
    newOrders: 2,
    activeOrders: 4,
    publishedProducts: 7,
    recentOrders: [order],
    ordersVersion: 0,
    storeError: null,
    publishing: false,
    openOrders: vi.fn(),
    openShopSettings: vi.fn(),
    togglePublish: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    refreshStore: vi.fn(async () => {}),
    ...overrides,
  };
  render(<MerchantStoreProvider value={value}><OnlineStoreHub /></MerchantStoreProvider>);
  return value;
}

afterEach(cleanup);

describe('Online store hub', () => {
  it('shows the live catalogue and pickup counts supplied by the merchant store', () => {
    setup();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('4')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });

  it('opens the existing pre-filled GST invoice flow for a queued order', () => {
    const received = vi.fn();
    window.addEventListener('hisaaboo:bill-from-order', received);
    try {
      setup();
      fireEvent.click(screen.getByRole('button', { name: /Generate GST bill/ }));
      expect(received).toHaveBeenCalledTimes(1);
      expect((received.mock.calls[0]?.[0] as CustomEvent | undefined)?.detail).toEqual(order);
    } finally {
      window.removeEventListener('hisaaboo:bill-from-order', received);
    }
  });

  it('opens the full order queue and the requested store settings', () => {
    const store = setup();
    fireEvent.click(screen.getByRole('button', { name: 'View all' }));
    fireEvent.click(screen.getByRole('button', { name: 'Counter QR' }));
    fireEvent.click(screen.getByRole('button', { name: /Update catalogue/ }));
    expect(store.openOrders).toHaveBeenCalledTimes(1);
    expect(store.openShopSettings).toHaveBeenNthCalledWith(1, 'qr');
    expect(store.openShopSettings).toHaveBeenNthCalledWith(2, 'catalogue');
  });

  it('lets an unpublished shop go live from the dashboard', () => {
    const store = setup({ business: { ...setupBusiness(), is_published: false } });
    fireEvent.click(screen.getByRole('button', { name: 'Publish shop page' }));
    expect(store.togglePublish).toHaveBeenCalledTimes(1);
  });

  it('keeps the existing unpublish control available for a live shop', () => {
    const store = setup();
    fireEvent.click(screen.getByRole('button', { name: 'Unpublish shop page' }));
    expect(store.togglePublish).toHaveBeenCalledTimes(1);
  });
});

function setupBusiness(): MerchantStoreContextValue['business'] {
  return {
    id: 'shop-1', slug: 'asha-electricals', public_name: 'Asha Electricals', is_published: true,
    category: 'Electricals', city: 'Bijnor', locality: 'Main Market', address: null,
    phone: null, hours: null, tagline: null,
  };
}
