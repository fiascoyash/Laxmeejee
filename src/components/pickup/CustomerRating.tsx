import { useEffect, useState } from 'react';
import { Star } from 'lucide-react';
import { loadReviewStats } from '@/lib/pickup-feedback';

export function CustomerRating({ slug }: { slug: string }) {
  const [stats, setStats] = useState<Awaited<ReturnType<typeof loadReviewStats>>>(null);
  useEffect(() => {
    let alive = true;
    setStats(null);
    loadReviewStats(slug).then(value => { if (alive) setStats(value); }).catch(() => {});
    return () => { alive = false; };
  }, [slug]);
  if (!stats || stats.average === null || stats.count < 5) return null;
  return <span className="inline-flex items-center gap-1 rounded-md bg-background px-3 py-1.5 text-foreground" title="Customer-confirmed orders; excludes ineligible ratings. Not proof of payment."><Star className="size-3 fill-primary text-primary" aria-hidden="true" />{stats.average.toFixed(1)} / 5 · {stats.count} customer ratings</span>;
}