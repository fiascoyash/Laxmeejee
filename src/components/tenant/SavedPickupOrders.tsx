import { useEffect, useState } from 'react';
import { Link } from '@tanstack/react-router';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { readSavedPickups, removeSavedPickup, watchSavedPickups, type SavedPickup } from '@/lib/saved-pickups';

export function SavedPickupOrders() {
  const [orders, setOrders] = useState<SavedPickup[]>([]);
  useEffect(() => {
    const refresh = () => setOrders(readSavedPickups());
    refresh();
    return watchSavedPickups(refresh);
  }, []);
  useEffect(() => {
    let alive = true;
    const check = async () => {
      for (const order of orders) {
        try {
          const { data, error } = await supabase.rpc('track_pickup_order', { _code: order.code, _phone: order.phone });
          const status = data && typeof data === 'object' && !Array.isArray(data) ? data['status'] : null;
          if (alive && !error && (status === 'collected' || status === 'cancelled')) removeSavedPickup(order.code, order.phone);
        } catch { /* Keep saved codes if the connection fails. */ }
      }
    };
    void check(); const timer = setInterval(check, 15000);
    return () => { alive = false; clearInterval(timer); };
  }, [orders]);
  return <section aria-label="Your pickup orders" className="mb-6 border-y py-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-semibold">Your pickup orders</h3><Button asChild variant="link"><Link to="/track" search={{ code: '', phone: '' }}>Find an order<ArrowRight /></Link></Button></div>
    {orders.map(order => <div key={`${order.code}-${order.phone}`} className="mt-3 flex flex-wrap items-center justify-between gap-2"><p className="min-w-0 break-words text-sm"><strong>{order.nickname}</strong> · #{order.code}</p><Button asChild variant="outline" size="sm"><Link to="/track" search={{ code: order.code, phone: order.phone }}>Track Order<ArrowRight /></Link></Button></div>)}
  </section>;
}