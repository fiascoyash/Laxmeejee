import { useEffect, useState } from 'react';
import { CheckCircle2, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { FEEDBACK_TAGS, loadFeedback, submitFeedback, type Feedback, type FeedbackInput } from '@/lib/pickup-feedback';

export function CustomerFeedback({ code, phone }: { code: string; phone: string }) {
  const [saved, setSaved] = useState<Feedback | null>(null);
  const [available, setAvailable] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<FeedbackInput['receipt'] | null>(null);
  const [rating, setRating] = useState<number | null>(null);
  const [tags, setTags] = useState<FeedbackInput['tags']>([]);
  const [comment, setComment] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let alive = true;
    setLoading(true); setError('');
    loadFeedback(code, phone).then(state => {
      if (alive) { setAvailable(state.available); setSaved(state.feedback ?? null); }
    }).catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Could not load feedback.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [code, phone, retry]);

  async function save() {
    if (!receipt || busy) return;
    setBusy(true); setError('');
    try {
      await submitFeedback(code, phone, { receipt, rating: receipt === 'received' ? rating : null, tags, comment });
      const state = await loadFeedback(code, phone);
      if (!state.feedback) throw new Error('Your response could not be confirmed. Please check again.');
      setSaved(state.feedback);
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not save your response.'); }
    finally { setBusy(false); }
  }

  return <section className="mt-5 space-y-3 border-t pt-4" aria-label="Customer order confirmation">
    <h2 className="text-lg font-semibold">Did you receive your order?</h2>
    {loading ? <p role="status" className="text-sm text-muted-foreground">Checking your response…</p> : saved ? <>
      <p role="status" className="flex items-center gap-2 text-sm font-medium"><CheckCircle2 className="size-4 text-primary" />{saved.receipt === 'received' ? 'You confirmed receiving your order.' : 'Your order issue has been shared with the shop.'}</p>
      {saved.rating !== null && <p className="text-sm">Your rating: {saved.rating} / 5{!saved.score_eligible ? ' · Saved, but not included in the public score.' : ' · Subject to the public rating waiting period.'}</p>}
      {saved.exclusion && <p className="text-xs text-muted-foreground">{saved.exclusion}</p>}
      {saved.comment && <p className="break-words text-sm">{saved.comment}</p>}
    </> : available ? <>
      <p className="text-sm text-muted-foreground">The shop marked this order collected. Your response is optional.</p>
      <div className="flex flex-wrap gap-2" role="group" aria-label="Order receipt">
        <Button disabled={busy} variant={receipt === 'received' ? 'default' : 'outline'} aria-pressed={receipt === 'received'} onClick={() => { setReceipt('received'); setTags([]); }}>Yes, received</Button>
        <Button disabled={busy} variant={receipt === 'issue' ? 'default' : 'outline'} aria-pressed={receipt === 'issue'} onClick={() => { setReceipt('issue'); setRating(null); setTags([]); }}>Issue with order</Button>
      </div>
      {receipt && <>
        {receipt === 'received' && <div><p className="mb-2 text-sm font-medium">Rating (optional)</p><div className="flex gap-1" role="group" aria-label="Rate this order">{[1,2,3,4,5].map(n => <Button key={n} disabled={busy} size="icon" variant="ghost" aria-label={`${n} star${n === 1 ? '' : 's'}`} aria-pressed={rating === n} onClick={() => setRating(rating === n ? null : n)}><Star className={rating !== null && n <= rating ? 'size-6 fill-primary text-primary' : 'size-6 text-muted-foreground'} /></Button>)}</div></div>}
        <div className="flex flex-wrap gap-2">{FEEDBACK_TAGS.filter(t => receipt === 'received' ? !['Not received','Item problem'].includes(t) : ['Not received','Item problem'].includes(t)).map(t => <Button key={t} disabled={busy} size="sm" variant={tags.includes(t) ? 'secondary' : 'outline'} aria-pressed={tags.includes(t)} onClick={() => setTags(tags.includes(t) ? tags.filter(v => v !== t) : [...tags,t])}>{t}</Button>)}</div>
        <label className="block text-sm font-medium">Comment (optional)<Textarea disabled={busy} className="mt-1" value={comment} onChange={e => setComment(e.target.value)} maxLength={500} rows={3} /></label>
        <p className="text-xs text-muted-foreground">Your response is shared with the shop and cannot be edited after submitting. No rating is required.</p>
        <Button disabled={busy} className="w-full" onClick={() => void save()}>{busy ? 'Saving…' : 'Submit response'}</Button>
      </>}
    </> : !error && <p className="text-sm text-muted-foreground">Feedback is not available for this order.</p>}
    {error && <div><p role="alert" className="text-sm text-destructive">{error}</p><Button variant="ghost" size="sm" disabled={busy} onClick={() => setRetry(n => n+1)}>Try again</Button></div>}
  </section>;
}