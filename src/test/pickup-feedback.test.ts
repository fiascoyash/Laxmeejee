// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
const shop = '00000000-0000-0000-0000-000000000001';
const user = '00000000-0000-0000-0000-000000000002';
let index = 0;
beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users(id uuid PRIMARY KEY, phone text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT nullif(current_setting('test.user',true),'')::uuid $$;
    CREATE TABLE public.businesses(id uuid PRIMARY KEY, slug text, phone text, is_published boolean);
    CREATE TABLE public.business_members(business_id uuid, user_id uuid);
    CREATE FUNCTION public.is_business_member(bid uuid) RETURNS boolean LANGUAGE sql SECURITY DEFINER SET search_path=public AS $$ SELECT EXISTS(SELECT 1 FROM business_members WHERE business_id=bid AND user_id=auth.uid()) $$;
    CREATE TABLE public.pickup_orders(id uuid PRIMARY KEY, business_id uuid, order_code text, customer_phone text,
      status text, total numeric, created_at timestamptz, accepted_at timestamptz, ready_at timestamptz, collected_at timestamptz);
  `);
  await db.exec(readFileSync('docs/customer-reviews-setup.sql','utf8'));
}, 30000);
beforeEach(async () => {
  index = 0;
  await db.exec(`TRUNCATE pickup_feedback,pickup_feedback_limits,pickup_orders,business_members,auth.users,businesses CASCADE;
    SELECT set_config('test.user','',false);
    INSERT INTO businesses VALUES('${shop}','test-shop','9999999999',true);`);
});
afterAll(async () => { await db.close(); });

async function order(phone = '9123456789', extra = '') {
  index++;
  const id = `10000000-0000-0000-0000-${String(index).padStart(12,'0')}`;
  const code = `CODE${index}`;
  await db.query(`INSERT INTO pickup_orders VALUES($1,$2,$3,$4,'collected',100,
    now()-interval '20 minutes',now()-interval '18 minutes',now()-interval '5 minutes',now());`, [id,shop,code,phone]);
  if (extra) await db.exec(`UPDATE pickup_orders SET ${extra} WHERE id='${id}'`);
  return { id, code, phone, device: `browser-device-${String(index).padStart(10,'0')}` };
}
async function submit(o: Awaited<ReturnType<typeof order>>, receipt = 'received', rating: number | null = 5, comment = '', device = o.device) {
  const r = await db.query<{ result: { ok: boolean; already_saved?: boolean } }>(
    'SELECT public.submit_pickup_feedback($1,$2,$3,$4,$5,$6,$7) AS result', [o.code,o.phone,receipt,rating,[],comment,device]);
  return r.rows[0]?.result;
}
async function feedback(id: string) {
  return (await db.query<{ score_eligible: boolean; receipt: string; rating: number | null; exclusion: string | null }>('SELECT * FROM pickup_feedback WHERE order_id=$1',[id])).rows[0];
}

describe('customer confirmation and protected review scoring', () => {
  it('records a received confirmation with an optional rating', async () => {
    const o = await order(); expect((await submit(o))?.ok).toBe(true);
    expect(await feedback(o.id)).toMatchObject({ receipt:'received',rating:5,score_eligible:true });
  });
  it('saves receipt without requiring stars', async () => {
    const o=await order(); expect((await submit(o,'received',null))?.ok).toBe(true);
    expect(await feedback(o.id)).toMatchObject({ receipt:'received',rating:null,score_eligible:false });
  });
  it('records an issue without an automatic rating', async () => {
    const o=await order(); expect((await submit(o,'issue',null,'Never received it'))?.ok).toBe(true);
    expect(await feedback(o.id)).toMatchObject({ receipt:'issue',rating:null,score_eligible:false });
  });
  it('rejects stars attached to an issue', async () => {
    const o=await order(); expect((await submit(o,'issue',5))?.ok).toBe(false); expect(await feedback(o.id)).toBeUndefined();
  });
  it('deduplicates immutable responses', async () => {
    const o=await order(); await submit(o); expect((await submit(o,'received',1))?.already_saved).toBe(true);
    expect(await feedback(o.id)).toMatchObject({ rating:5 });
  });
  it('rejects a mismatching code and phone', async () => {
    const o=await order(); expect((await submit({...o,phone:'9876543210'}))?.ok).toBe(false); expect(await feedback(o.id)).toBeUndefined();
  });
  it('rejects feedback before collection', async () => {
    const o=await order('9123456789',"status='ready'"); expect((await submit(o))?.ok).toBe(false);
  });
  it('excludes the merchant shop phone from ratings', async () => {
    const o=await order('9999999999'); await submit(o); expect((await feedback(o.id))?.score_eligible).toBe(false);
  });
  it('excludes signed-in shop members regardless of supplied phone', async () => {
    await db.exec(`INSERT INTO business_members VALUES('${shop}','${user}'); SELECT set_config('test.user','${user}',false);`);
    const o=await order(); await submit(o); expect((await feedback(o.id))?.score_eligible).toBe(false);
  });
  it('excludes member registered phone even when signed out', async () => {
    await db.exec(`INSERT INTO auth.users VALUES('${user}','+919123456789'); INSERT INTO business_members VALUES('${shop}','${user}');`);
    const o=await order(); await submit(o); expect((await feedback(o.id))?.score_eligible).toBe(false);
  });
  it('excludes orders completed in less than ten minutes', async () => {
    const o=await order('9123456789',"created_at=now()-interval '9 minutes', accepted_at=now()-interval '8 minutes'");
    await submit(o); expect((await feedback(o.id))?.score_eligible).toBe(false);
  });
  it('excludes zero-value orders', async () => {
    const o=await order('9123456789','total=0'); await submit(o); expect((await feedback(o.id))?.score_eligible).toBe(false);
  });
  it('limits one phone to one rated order per shop in thirty days', async () => {
    await submit(await order()); const next=await order(); await submit(next); expect((await feedback(next.id))?.score_eligible).toBe(false);
  });
  it('permits a new rating after thirty days', async () => {
    await submit(await order()); await db.exec("UPDATE pickup_feedback SET created_at=now()-interval '31 days'");
    const next=await order(); await submit(next); expect((await feedback(next.id))?.score_eligible).toBe(true);
  });
  it('limits repeated browser ratings even with different phone numbers', async () => {
    const first=await order(); await submit(first); const next=await order('9876543210'); await submit(next,'received',5,'',first.device);
    expect((await feedback(next.id))?.score_eligible).toBe(false);
  });
  it('caps contributing shop ratings at five per UTC day', async () => {
    for(let i=0;i<5;i++) await submit(await order(`912345678${i}`));
    const next=await order('9123456785'); await submit(next); expect((await feedback(next.id))?.score_eligible).toBe(false);
  });
  it('hides the public score until five distinct customers and 24 hours', async () => {
    for(let i=0;i<5;i++) await submit(await order(`912345678${i}`));
    const stats = async () => (await db.query<{ s: { count: number; average: number | null } }>("SELECT pickup_review_stats('test-shop') AS s")).rows[0]?.s;
    expect(await stats()).toEqual({ count:0, average:null });
    await db.exec("UPDATE pickup_feedback SET created_at=now()-interval '25 hours'");
    expect(await stats()).toEqual({ count:5, average:5 });
    await db.exec('UPDATE businesses SET is_published=false'); expect(await stats()).toEqual({ count:0, average:null });
  });
  it('does not expose feedback after six failed code lookups in fifteen minutes', async () => {
    const o=await order(); for(let i=0;i<6;i++) await submit({...o,phone:'9876543210'});
    expect((await submit(o))?.ok).toBe(false);
    await db.exec("UPDATE pickup_feedback_limits SET window_started_at=now()-interval '16 minutes'");
    expect((await submit(o))?.ok).toBe(true);
  });
  it('denies anonymous raw feedback reads and direct authenticated writes', async () => {
    const o=await order(); await submit(o);
    await db.exec('SET ROLE anon'); await expect(db.query('SELECT * FROM pickup_feedback')).rejects.toThrow(); await db.exec('RESET ROLE');
    await db.exec('SET ROLE authenticated'); await expect(db.query('DELETE FROM pickup_feedback')).rejects.toThrow(); await db.exec('RESET ROLE');
  });
  it('rejects comments over 500 characters', async () => {
    const o=await order(); expect((await submit(o,'received',5,'a'.repeat(501)))?.ok).toBe(false);
  });
  it('rejects ratings outside the one-to-five range', async () => {
    const o=await order(); expect((await submit(o,'received',0))?.ok).toBe(false);
    expect((await submit(o,'received',6))?.ok).toBe(false); expect(await feedback(o.id)).toBeUndefined();
  });
  it('requires the accepted and ready history for scoring', async () => {
    const o=await order('9123456789','ready_at=NULL'); await submit(o); expect((await feedback(o.id))?.score_eligible).toBe(false);
  });
  it('does not display a score for only four distinct customers', async () => {
    for(let i=0;i<4;i++) await submit(await order(`912345678${i}`));
    await db.exec("UPDATE pickup_feedback SET created_at=now()-interval '25 hours'");
    expect((await db.query<{ s: { count: number; average: number | null } }>("SELECT pickup_review_stats('test-shop') AS s")).rows[0]?.s).toEqual({ count:0,average:null });
  });
  it('includes negative as well as positive ratings in the public average', async () => {
    for(let i=0;i<5;i++) await submit(await order(`912345678${i}`),'received',i+1);
    await db.exec("UPDATE pickup_feedback SET created_at=now()-interval '25 hours'");
    expect((await db.query<{ s: { count: number; average: number | null } }>("SELECT pickup_review_stats('test-shop') AS s")).rows[0]?.s).toEqual({ count:5,average:3 });
  });
  it('excludes ratings older than 180 days', async () => {
    for(let i=0;i<5;i++) await submit(await order(`912345678${i}`));
    await db.exec("UPDATE pickup_feedback SET created_at=now()-interval '181 days'");
    expect((await db.query<{ s: { count: number; average: number | null } }>("SELECT pickup_review_stats('test-shop') AS s")).rows[0]?.s).toEqual({ count:0,average:null });
  });
  it('allows members to read only their own shop feedback', async () => {
    const o=await order(); await submit(o);
    await db.exec('SET ROLE authenticated'); expect((await db.query('SELECT receipt FROM pickup_feedback')).rows).toHaveLength(0); await db.exec('RESET ROLE');
    await db.exec(`INSERT INTO business_members VALUES('${shop}','${user}'); SELECT set_config('test.user','${user}',false); SET ROLE authenticated;`);
    expect((await db.query('SELECT receipt FROM pickup_feedback')).rows).toEqual([{receipt:'received'}]); await db.exec('RESET ROLE');
  });
});