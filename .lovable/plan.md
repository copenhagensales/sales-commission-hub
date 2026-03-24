

# Add fbclid to Customer Inquiries

## Changes

| Change | What |
|--------|------|
| **Database migration** | `ALTER TABLE customer_inquiries ADD COLUMN fbclid TEXT;` |
| **`supabase/functions/customer-inquiry-webhook/index.ts`** | Extract `fbclid` (or `Fbclid`) from request body, include in sanitized insert object |

## Edge Function Change (line ~113)
- Destructure: add `fbclid: rawFbclid` and `Fbclid` from body
- Resolve: `const fbclid = rawFbclid || Fbclid || null;`
- Add `fbclid` to the `sanitized` object (trimmed, max 500 chars)

