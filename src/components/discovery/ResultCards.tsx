import { Link } from '@tanstack/react-router';
import { ArrowRight, MapPin, Navigation, Store } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import type { Proximity } from '@/lib/customerLocation';
import type { ItemHit } from '@/lib/localSearch';

export function ProximityBadge({ proximity, className = '' }: { proximity?: Proximity | undefined; className?: string }) {
  if (!proximity?.label) return null;
  return (
    <span className={`inline-flex shrink-0 items-center gap-1 rounded-full bg-stock-action/10 px-2 py-0.5 text-xs font-medium text-stock-action ${className}`}>
      <Navigation className="size-3" aria-hidden="true" />{proximity.label}
    </span>
  );
}

/** One product or service from a shop, with its price, stock and a clear next step. */
export function ItemResultCard({ hit }: { hit: ItemHit }) {
  const { product, shop, proximity, kind } = hit;
  const place = [shop.locality, shop.city].filter(Boolean).join(', ');
  return (
    <article className="flex h-full min-w-0 flex-col rounded-lg border bg-card p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">{kind === 'service' ? 'Service' : product.category || 'Product'}</span>
        <ProximityBadge proximity={proximity} />
      </div>
      <h4 className="mt-2 line-clamp-2 break-words text-base font-semibold">{product.name}</h4>
      <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground"><Store className="size-4 shrink-0" aria-hidden="true" /><span className="truncate">{shop.public_name}</span></p>
      {place && <p className="mt-1 flex items-center gap-1.5 text-xs text-muted-foreground"><MapPin className="size-3.5 shrink-0" aria-hidden="true" /><span className="truncate">{place}</span></p>}
      <div className="mt-auto flex items-end justify-between gap-3 pt-4">
        <div className="min-w-0">
          <p className="font-semibold">₹{Number(product.price).toLocaleString('en-IN')}{product.unit ? <span className="text-xs font-normal text-muted-foreground"> /{product.unit}</span> : null}</p>
          <p className={`text-xs ${product.in_stock ? 'text-stock-action' : 'text-muted-foreground'}`}>{product.in_stock ? (kind === 'service' ? 'Available' : 'In stock · Pickup') : (kind === 'service' ? 'Not available now' : 'Out of stock')}</p>
        </div>
        <Button asChild size="sm" variant={product.in_stock ? 'default' : 'outline'} className={product.in_stock ? 'bg-stock-action text-stock-action-foreground hover:bg-stock-action/90' : ''}>
          <Link to="/shop/$slug" params={{ slug: shop.slug }}>{product.in_stock && kind === 'product' ? 'Order for pickup' : 'View shop'}<ArrowRight aria-hidden="true" /></Link>
        </Button>
      </div>
    </article>
  );
}

/** Fixed-height placeholders so results replace them without moving the page. */
export function ResultsSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div role="status" aria-label="Finding shops…" className="mt-6">
      <Skeleton className="mb-2 h-6 w-48" />
      <Skeleton className="mb-6 h-4 w-32" />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="h-64 rounded-lg border bg-card p-5">
            <Skeleton className="h-5 w-24" />
            <Skeleton className="mt-4 h-6 w-3/4" />
            <Skeleton className="mt-3 h-4 w-1/2" />
            <Skeleton className="mt-8 h-4 w-full" />
            <Skeleton className="mt-2 h-4 w-5/6" />
            <Skeleton className="mt-6 h-9 w-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Finding shops…</span>
    </div>
  );
}
