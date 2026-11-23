# Activate customer confirmation and reviews

The website code is ready, but reviews remain unavailable until the original database is updated. Existing checkout, tracking, Google sign-in and order statuses are unchanged. No change was applied to the unrelated Lovable database.

## One-time setup

1. Open the SQL editor for the **original database account used by your live website**.
2. Run the complete `docs/customer-reviews-setup.sql` script once. It runs in a transaction and creates two tables and protected functions. Do not run it on a newly created database. If it reports an error, stop and share the error; do not run selected fragments.
3. Deploy the updated website to Cloudflare with the existing `.env.production` connection unchanged.
4. Complete a real order, then open its tracking link with the matching pickup code and phone number. Choose **Yes, received** or **Issue with order**. Stars, tags and comments are optional. Submit, reload and check that your response appears.

## Rating safeguards

- Only orders currently marked collected accept feedback, with a recorded collection time.
- One immutable response per order; repeat submissions do not duplicate it.
- Shop phone numbers, signed-in shop members and members' registered phone numbers do not contribute to ratings. Their receipt responses are still recorded.
- A rating needs an accepted → ready → collected history and at least **10 minutes** from placement to collection; zero-value orders do not count.
- At most **one contributing rating per phone or browser per shop every 30 days** and **five per shop per UTC day**. Concurrent submissions cannot bypass these caps.
- Public scores wait **24 hours**, cover **180 days**, and appear only with **five distinct customers**. All eligible star values are counted equally, not just positive reviews.
- Issues and unrated confirmations are saved but do not become star ratings or automatic customer penalties.
- Failed feedback lookups are limited to **six per pickup code in 15 minutes**. The existing tracking lookup is unchanged.
- Only aggregate stars and counts are public. Shop members can read their own feedback; nobody can edit or delete it through the normal website connection. Customer details are not exposed through the public rating function.

## Limits

This is not proof of payment or delivery. Guest phone numbers are not OTP-verified, order codes can be shared, browser IDs can be reset, and colluding people can wait or use other phone numbers. These safeguards reduce easy manipulation; they do not guarantee genuine purchases. No IP blocking or GPS-based review identity claim is made. Reviews are separate from the existing reply-speed badge and do not change it.

Merchant feedback appears under collected orders: open the order queue, select **Show completed**, and use **Refresh** to check new responses. Customer feedback also appears when reopening that order's tracking link. A separate review inbox is not included.

## Verification before going live

Test received, issue, duplicate submission, wrong phone, uncollected order and a shop-phone review. Confirm a rejected or unavailable submission never shows a success message. Verify ratings do not appear for an unpublished shop. Automated isolated database tests cover these rules; live database activation and a real customer submission still require the setup above.