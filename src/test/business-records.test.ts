// @vitest-environment node
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';

const db = new PGlite();
const shop = '00000000-0000-0000-0000-000000000001';
const otherShop = '00000000-0000-0000-0000-000000000002';
const user = '00000000-0000-0000-0000-000000000003';

beforeAll(async () => {
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE TABLE businesses(id uuid PRIMARY KEY);
    CREATE TABLE business_members(business_id uuid, user_id uuid);
    CREATE FUNCTION current_business_id() RETURNS uuid LANGUAGE sql AS
      $$ SELECT nullif(current_setting('test.shop', true), '')::uuid $$;
    CREATE FUNCTION is_business_member(bid uuid) RETURNS boolean LANGUAGE sql
      SECURITY DEFINER SET search_path = public AS $$
        SELECT EXISTS(SELECT 1 FROM business_members WHERE business_id = bid
          AND user_id = nullif(current_setting('test.user', true), '')::uuid)
      $$;`);
  await db.exec(readFileSync('docs/business-records-setup.sql', 'utf8'));
}, 30000);
beforeEach(async () => {
  await db.exec(`RESET ROLE;
    TRUNCATE business_records, business_members, businesses CASCADE;
    INSERT INTO businesses VALUES ('${shop}'), ('${otherShop}');
    INSERT INTO business_members VALUES ('${shop}', '${user}');
    SELECT set_config('test.user', '${user}', false);
    SELECT set_config('test.shop', '${shop}', false);
    INSERT INTO business_records (business_id, collection, record_id, data)
      VALUES ('${otherShop}', 'invoices', 'INV-1', '{"total":200}');
    SET ROLE authenticated;`);
});
afterAll(async () => { await db.close(); });

describe('owner-applied billing storage SQL', () => {
  it('defaults records to the current shop and preserves invoice data', async () => {
    const result = await db.query<{ business_id: string; data: { total: number } }>(`
      INSERT INTO business_records (collection, record_id, data)
      VALUES ('invoices', 'INV-1', '{"total":100}') RETURNING business_id, data`);
    expect(result.rows[0]).toEqual({ business_id: shop, data: { total: 100 } });
  });
  it('does not expose another shop records to a signed-in member', async () => {
    expect((await db.query('SELECT * FROM business_records')).rows).toHaveLength(0);
  });
  it('rejects inserting records for another shop', async () => {
    await expect(db.query(`INSERT INTO business_records (business_id, collection, record_id, data)
      VALUES ($1, 'customers', 'C-1', '{}')`, [otherShop])).rejects.toThrow(/row-level security/);
  });
  it('cannot update another shop records', async () => {
    const result = await db.query(`UPDATE business_records SET data = '{"total":0}'
      WHERE business_id = $1 RETURNING record_id`, [otherShop]);
    expect(result.rows).toHaveLength(0);
    await db.exec('RESET ROLE');
    const rows = await db.query<{ data: { total: number } }>('SELECT data FROM business_records');
    expect(rows.rows[0]?.data.total).toBe(200);
  });
  it('denies anonymous access', async () => {
    await db.exec('RESET ROLE; SET ROLE anon');
    await expect(db.query('SELECT * FROM business_records')).rejects.toThrow(/permission denied/);
  });
  it('keeps tombstones instead of allowing hard deletes', async () => {
    await db.exec(`INSERT INTO business_records (collection, record_id, data)
      VALUES ('customers', 'C-1', '{}');
      UPDATE business_records SET deleted = true WHERE record_id = 'C-1';`);
    const result = await db.query<{ deleted: boolean }>("SELECT deleted FROM business_records WHERE record_id = 'C-1'");
    expect(result.rows[0]?.deleted).toBe(true);
    await expect(db.query('DELETE FROM business_records')).rejects.toThrow(/permission denied/);
  });
  it('rejects duplicate IDs within the same shop and collection', async () => {
    await db.exec(`INSERT INTO business_records (collection, record_id, data)
      VALUES ('invoices', 'INV-1', '{}')`);
    await expect(db.exec(`INSERT INTO business_records (collection, record_id, data)
      VALUES ('invoices', 'INV-1', '{}')`)).rejects.toThrow(/duplicate key/);
  });
  it('uses server timestamps rather than a device-supplied timestamp', async () => {
    const result = await db.query<{ recent: boolean }>(`INSERT INTO business_records
      (collection, record_id, data, updated_at) VALUES ('invoices', 'INV-1', '{}', '2000-01-01')
      RETURNING updated_at > now() - interval '1 minute' AS recent`);
    expect(result.rows[0]?.recent).toBe(true);
  });
});