

## Fix: Function Search Path Mutable

### Problem
Supabase linter flags functions with `SECURITY DEFINER` that lack an explicit `SET search_path`. Without it, a malicious actor could manipulate the search path to hijack function calls. Two functions are affected:

1. **`cleanup_stale_leaderboard_cache()`** — deletes old leaderboard cache rows
2. **`schedule_integration_sync(...)`** — schedules cron jobs for integration sync

### Solution
One database migration that adds `SET search_path TO 'public'` to both functions using `CREATE OR REPLACE FUNCTION`.

### Technical Details

**New migration file** with two `CREATE OR REPLACE FUNCTION` statements:

1. `cleanup_stale_leaderboard_cache()` — add `SET search_path TO 'public'` (body unchanged)
2. `schedule_integration_sync(...)` — add `SET search_path TO 'public'` (body unchanged, note: this one also references `cron` and `net` schemas, so we may need `SET search_path TO 'public', 'cron', 'net', 'extensions'`)

No code changes needed — migration only.

