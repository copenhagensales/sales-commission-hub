

## Update `send-meta-conversion` with additional user data

### Changes to `supabase/functions/send-meta-conversion/index.ts`

1. **Rename existing `hashEmail` to `hashValue`** — make it generic (already does trim+lowercase+SHA-256, just rename for clarity).

2. **Expand `user_data` object** — conditionally add hashed `ph`, `fn`, `ln` from `record` fields alongside existing `em` and `fbc`:

```
user_data: {
  fbc,
  em: [hashed email],        // already exists
  ph: [hashed phone],        // NEW - if record.phone exists
  fn: [hashed first_name],   // NEW - if record.first_name exists
  ln: [hashed last_name],    // NEW - if record.last_name exists
}
```

3. **No other changes** — fbclid handling, event_name (`Hire`), API call structure, test_event_code all stay identical.

Single file edit, automatic redeployment.

