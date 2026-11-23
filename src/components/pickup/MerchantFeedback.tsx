import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { z } from 'zod';
import { Button } from '@/components/ui/button';

const entrySchema = z.object({ receipt: z.enum(['received','issue']), rating: z.number().nullable(), comment: z.string(), tags: z.array(z.string()) });
type FeedbackQuery = { from: (table: 'pickup_feedback') => { select: (columns: string) => { eq: (column: string, value: string) => { eq: (column: string, value: string) => { maybeSingle: () => PromiseLike<{ data: unknown; error: unknown }> } } } } };

export function MerchantFeedback({ businessId, orderId, version }: { businessId: string; orderId: string; version: number }) {
  const [feedback, setFeedback] = useState<z.infer<typeof entrySchema> | null>(null);
  const [retry, setRetry] = useState(0);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    setFeedback(null); setFailed(false);
    // RLS checks membership; select no hashes or customer identifiers.
    const client = supabase as unknown as FeedbackQuery;
    Promise.resolve().then(() => client.from('pickup_feedback').select('receipt,rating,comment,tags')
      .eq('business_id',businessId).eq('order_id',orderId).maybeSingle()).then(({ data, error }) => {
      if (!alive) return;
      if (error) { setFailed(true); return; }
      const parsed = entrySchema.safeParse(data);
      if (parsed.success) setFeedback(parsed.data);
    }).catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, [businessId, orderId, version, retry]);
  if (failed) return <Button size="sm" variant="ghost" onClick={() => setRetry(n => n+1)}>Check customer feedback</Button>;
  if (!feedback) return <p className="mt-2 text-xs text-muted-foreground">Customer has not confirmed receipt.</p>;
  return <div className="mt-2 space-y-1 border-t pt-2">
    <p className={feedback.receipt === 'issue' ? 'text-sm font-semibold text-destructive' : 'text-sm font-semibold text-primary'}>{feedback.receipt === 'received' ? 'Customer confirmed receipt' : 'Customer reported an order issue'}{feedback.rating !== null ? ` · ${feedback.rating} / 5` : ''}</p>
    {!!feedback.tags.length && <p className="text-xs text-muted-foreground">{feedback.tags.join(' · ')}</p>}
    {feedback.comment && <p className="break-words text-sm">{feedback.comment}</p>}
  </div>;
}