

## Fix: Referral Code Lookup for Emma Sylvest

### Investigation Results
Emma's data is correct in the database:
- `auth_user_id` matches her auth account
- `referral_code = EMMC2591`
- `is_active = true`
- RLS policies allow authenticated users to read active employees

The most likely cause is the `.eq('private_email', ...)` fallback being **case-sensitive**, and the primary `auth_user_id` query silently failing in some edge cases. The hook also never checks `work_email`.

### Fix — `src/hooks/useReferrals.ts`

Make the lookup more robust:

1. **Primary query**: Keep `.eq('auth_user_id', user.id)` — unchanged
2. **Fallback query**: Replace case-sensitive `.eq('private_email', ...)` with a case-insensitive `.or()` that checks both `private_email` and `work_email`:
   ```typescript
   .or(`private_email.ilike.${user.email},work_email.ilike.${user.email}`)
   ```
3. **Add `is_active` filter** to both queries to be explicit
4. **Better error handling**: Log errors from the primary query instead of silently swallowing them, so we can debug if it happens again

### Single file change
- `src/hooks/useReferrals.ts` lines 245-272

