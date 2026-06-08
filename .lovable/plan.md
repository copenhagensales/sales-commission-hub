## Security fixes — gruppeplan

Scanneren har fundet ~30 issues. Mange rammer **rød zone** (løn, pricing, GDPR, auth, RLS). Iht. CLAUDE.md §4 skal jeg have eksplicit godkendelse + plan før rød zone-ændringer. Jeg foreslår at lukke dem i 5 batches du kan godkende hver for sig, så vi ikke rører alt på én gang.

---

### Batch 1 — Edge functions uden auth (kritisk, lav risiko at fixe)
Tilføj auth-check (Bearer JWT + `is_owner`/`is_manager_or_above`) eller cron-secret. Mønstret findes allerede i `force-password-reset` og `_shared/gdpr-auth.ts`.

Filer:
- `set-user-password`, `create-employee-user`, `delete-auth-user` → owner-check
- `batch-set-fieldmarketing-passwords` → owner-check
- `generate-contract-pdf` → ejer-af-kontrakt eller manager
- `import-products` → manager
- `update-cron-schedule` → owner
- `snapshot-payroll-period` → cron-secret eller owner (RØD: rører løn-snapshots)
- `cleanup-inactive-employees` → cron-secret (RØD: sletter ansatte)
- `execute-scheduled-team-changes` → cron-secret
- `activate-pulse-survey` → cron-secret

Risiko: lav — vi tilføjer kun guards, fjerner ingen funktionalitet. Eksisterende UI-kald sender allerede JWT via `supabase.functions.invoke()`. Cron-jobs skal opdateres til at sende `x-cron-secret` header — jeg tilføjer en `CRON_SECRET` secret og opdaterer `pg_cron`-jobs.

### Batch 2 — RLS låses ned på finansielle/HR tabeller (RØD ZONE)
Erstat `USING(true)` med `is_manager_or_above(auth.uid())`:
- `salary_types` (løn — RØD)
- `booking_startup_bonus` (løn — RØD)
- `employee_absence` (egen-INSERT for medarbejder, fuld adgang for manager)
- `scheduled_team_changes` (manager)
- `integration_circuit_breaker` (kun service_role)
- `kpi_watermarks` (kun service_role)

### Batch 3 — Publikt læsbare data fjernes
- `kpi_cached_values` + `kpi_leaderboard_cache`: drop `USING(true)` SELECT; krav `authenticated`. TV-board flow skal validere kode server-side via edge function i stedet for direkte tabel-read.
- `tv_board_access`: drop public SELECT; lav RPC `verify_tv_board_code(code text) returns dashboard_config` (SECURITY DEFINER, returnerer kun match). Opdaterer `useTvBoardConfig` til at bruge RPC.
- `integration_debug_log`: restrict ALL til service_role + owner.
- Peer-data via `is_in_my_teams` på `absence_request_v2`, `career_wishes`, `car_quiz_submissions`, `car_quiz_completions`, `code_of_conduct_attempts`: skift til team-leader-or-above.

### Batch 4 — Storage buckets privatiseres
- `chat-attachments`: bucket → private, SELECT-policy kræver medlem af `chat_conversation_members`.
- `vehicle-return-photos`: bucket → private, SELECT-policy kræver egen confirmation eller manager.

Begge kræver at frontend henter via signed URLs i stedet for public URL. Jeg opdaterer relevante hooks.

### Batch 5 — XSS + Realtime + SECURITY DEFINER linter
- Sanitize kontrakt-HTML med DOMPurify (allerede installeret iht. memory) i `ContractSign.tsx`, `Contracts.tsx`, `SendContractDialog.tsx`.
- Realtime channel authorization: tilføj RLS på `realtime.messages` scoped til auth.uid().
- Supabase linter: SECURITY DEFINER view + functions executable af anon — gennemgå og REVOKE EXECUTE FROM anon på funktioner der ikke skal være offentlige.

---

### Hvad jeg foreslår
Start med **Batch 1 (edge functions auth)** — det er den største og mest akutte hul (kontooverttagelse muligt med kun anon-key). Det er let at rulle ud uden at bryde noget.

**Godkend Batch 1, så jeg går i gang?** Derefter tager vi Batch 2 (RLS løn-tabeller) som næste runde.

Hvis du vil have alle 5 batches i ét hug uden review pr. batch, sig "kør alle" — men jeg anbefaler batch-vis, så vi kan tjekke at intet brækker mellem runderne (især TV-board og chat-attachments hvor frontend ændres).
