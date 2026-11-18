import { Link } from '@tanstack/react-router';
import { MapPin, Clock, MessageCircle, Phone, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ProductPhoto } from '@/components/tenant/ProductPhoto';
import { matchingProducts, type DirectoryShop } from '@/lib/discovery';

const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN')}`;
function whatsapp(phone: string, product?: string) {
  let digits = phone.replace(/\D/g, '');
  if (digits.length === 10) digits = `91${digits}`;
  const text = product ? `Hi, is "${product}" available at your shop? (via Hisaaboo)` : 'Hi, I found your shop on Hisaaboo.';
  return `https://wa.me/${digits}?text=${encodeURIComponent(text)}`;
}

export function ShopResultCard({ shop, q, highlight }: { shop: DirectoryShop; q: string; highlight: boolean }) {
  const matches = matchingProducts(shop, q);
  const best = matches[0];
  const shown = best ? [best] : [...shop.products].sort((a, b) => Number(b.in_stock) - Number(a.in_stock)).slice(0, 3);
  const place = [shop.locality, shop.city].filter(Boolean).join(', ');
  return (
    <article className={`flex min-w-0 flex-col rounded-xl border bg-card p-5 ${highlight ? 'border-stock-action' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 break-words text-lg font-semibold">{shop.public_name}</h3>
        <span className="shrink-0 rounded-full bg-stock-action/10 px-3 py-1 text-xs font-semibold text-stock-action">Live now</span>
      </div>
      <p className="mt-1 flex items-start gap-1 text-sm text-muted-foreground">
        {place && <MapPin className="mt-0.5 size-4 shrink-0" aria-hidden="true" />}
        {[shop.category || 'Local business', place].filter(Boolean).join(' · ')}
      </p>
      {best ? (
        <div className="mt-4 flex items-center gap-4">
          <ProductPhoto path={best.image_path} name={best.name} className="h-24 w-24 border bg-background" />
          <div className="min-w-0">
            <p className="break-words font-semibold">{best.name}</p>
            <p className={`text-2xl font-bold ${best.in_stock ? 'text-stock-action' : 'text-muted-foreground'}`}>{inr(best.price)}{best.unit && <span className="text-sm font-normal text-muted-foreground"> / {best.unit}</span>}</p>
            <p className={`text-sm ${best.in_stock ? 'text-stock-action' : 'text-muted-foreground'}`}>{best.in_stock ? 'Available · Price confirmed' : 'Out of stock'}</p>
            {matches.length > 1 && <p className="mt-1 text-xs text-muted-foreground">+{matches.length - 1} more matching {matches.length === 2 ? 'item' : 'items'}</p>}
          </div>
        </div>
      ) : (
        <div className="mt-4 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">{shop.products.length} {shop.products.length === 1 ? 'product' : 'products'}</p>
          <ul className="mt-2 space-y-2">{shown.map((p, i) => <li key={p.product_id ?? i} className="flex items-start justify-between gap-3 text-sm"><span className="min-w-0 break-words">{p.name}{!p.in_stock && <span className="block text-xs text-muted-foreground">Out of stock</span>}</span><span className="shrink-0 font-medium">{inr(p.price)}</span></li>)}</ul>
          {shop.hours && <p className="mt-3 flex items-start gap-2 text-xs text-muted-foreground"><Clock className="size-4 shrink-0" aria-hidden="true" />{shop.hours}</p>}
        </div>
      )}
      <div className="mt-auto flex flex-wrap gap-2 pt-5">
        <Button asChild size="sm" className="bg-stock-action text-stock-action-foreground hover:bg-stock-action/90"><Link to="/shop/$slug" params={{ slug: shop.slug }}>View Store<ArrowRight aria-hidden="true" /></Link></Button>
        {shop.phone && <>
          <Button asChild size="sm" variant="secondary"><a href={whatsapp(shop.phone, best?.name)} target="_blank" rel="noopener noreferrer"><MessageCircle aria-hidden="true" />Contact Shop</a></Button>
          <Button asChild size="sm" variant="ghost" aria-label={`Call ${shop.public_name}`}><a href={`tel:${shop.phone}`}><Phone aria-hidden="true" /></a></Button>
        </>}
      </div>
    </article>
  );
}
