import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';

export const FEEDBACK_TAGS = ['Order ready', 'Friendly service', 'As ordered', 'Not received', 'Item problem'] as const;
export const feedbackInput = z.object({
  receipt: z.enum(['received', 'issue']),
  rating: z.number().int().min(1).max(5).nullable(),
  tags: z.array(z.enum(FEEDBACK_TAGS)).max(5),
  comment: z.string().trim().max(500),
}).refine(v => v.receipt === 'received' || v.rating === null, { message: 'Only received orders can be rated.' });
export type FeedbackInput = z.infer<typeof feedbackInput>;
export type Feedback = FeedbackInput & { score_eligible: boolean; exclusion: string | null };
const feedbackSchema = feedbackInput.and(z.object({ score_eligible: z.boolean(), exclusion: z.string().nullable() }));
const stateSchema = z.object({ available: z.boolean(), feedback: feedbackSchema.nullable().optional() });
const resultSchema = z.object({ ok: z.boolean(), message: z.string().optional(), already_saved: z.boolean().optional() });
const statsSchema = z.object({ count: z.number(), average: z.number().nullable() });

// Typed extension for owner-applied RPCs; do not modify generated database types.
type ReviewRpc = (name: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: { code?: string; message: string } | null }>;
const rpc = supabase.rpc.bind(supabase) as unknown as ReviewRpc;
export async function loadFeedback(code: string, phone: string) {
  const { data, error } = await rpc('get_pickup_feedback', { _code: code, _phone: phone });
  if (error) throw new Error(error.code === 'PGRST202' || error.code === '42883' ? 'Customer feedback is not available yet. Please contact the shop about your order.' : 'Could not load your feedback. Please try again.');
  return stateSchema.parse(data);
}
export async function submitFeedback(code: string, phone: string, input: FeedbackInput) {
  const value = feedbackInput.parse(input);
  let device = localStorage.getItem('hisaaboo_feedback_browser');
  if (!device || !/^[a-zA-Z0-9-]{16,80}$/.test(device)) {
    device = crypto.randomUUID();
    localStorage.setItem('hisaaboo_feedback_browser', device);
  }
  const { data, error } = await rpc('submit_pickup_feedback', { _code: code, _phone: phone, _receipt: value.receipt, _rating: value.rating, _tags: value.tags, _comment: value.comment, _device: device });
  if (error) throw new Error('Could not save your feedback. Please try again.');
  const result = resultSchema.parse(data);
  if (!result.ok) throw new Error(result.message ?? 'Could not save your feedback.');
  return result;
}
export async function loadReviewStats(slug: string) {
  const { data, error } = await rpc('pickup_review_stats', { _slug: slug });
  if (error) return null;
  const parsed = statsSchema.safeParse(data);
  return parsed.success ? parsed.data : null;
}