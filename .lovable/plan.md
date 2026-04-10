

## Plan: Daglig checklist-email med konfigurerbart tidspunkt, modtagere og manuel trigger

### Overblik
- Ny konfigurationstabel til tidspunkt + modtagere
- Ny edge function der sender daglig opsummering via M365
- Et enkelt dagligt cron-job (ikke hvert 15. minut) der kører på et fast tidspunkt
- "Send nu"-knap i admin-panelet til manuel trigger
- UI-felter til at vælge tidspunkt og modtagere

### Trin 1: Database — 2 nye tabeller

**`fm_checklist_email_config`** — singleton-konfiguration:
- `id`, `send_time` (text, default '20:00'), `is_active` (boolean), `created_at`, `updated_at`
- RLS: authenticated kan select/update

**`fm_checklist_email_recipients`** — modtagerliste:
- `id`, `employee_id` (ref employee_master_data), `created_at`, unique(employee_id)
- RLS: authenticated kan select/insert/delete

### Trin 2: Edge function `send-checklist-daily-summary`

Logik:
1. Hent config fra `fm_checklist_email_config` — tjek `is_active`
2. Hent modtagere fra `fm_checklist_email_recipients` + email fra `employee_master_data`
3. Find dagens ugedag, hent relevante `fm_checklist_templates`
4. Hent `fm_checklist_completions` for dagens dato
5. Byg HTML-rapport med ✅/❌ for hver opgave
6. Send via M365 Graph API (eksisterende secrets: `M365_CLIENT_ID`, `M365_CLIENT_SECRET`, `M365_TENANT_ID`, `M365_SENDER_EMAIL`)

Accepterer valgfri `?force=true` parameter for manuel trigger (springer `is_active`-check over).

### Trin 3: Cron-job — kører 1 gang dagligt

```sql
select cron.schedule(
  'fm-checklist-daily-summary',
  '0 18 * * *',  -- 18:00 UTC = 20:00 CET
  $$ select net.http_post(...) $$
);
```

Kører en gang dagligt kl. 20:00 CET. Ingen polling hvert 15. minut.

### Trin 4: UI i admin-sektionen

Tilføjer i "Administrer"-panelet i `FmChecklistContent.tsx`:

1. **Email-opsummering sektion** med:
   - **Aktiv/inaktiv** — Switch-toggle
   - **Afsendelsestidspunkt** — TimeSelect-komponent (allerede i projektet)
   - **Modtagere** — Select med aktive medarbejdere + badges med slet-knap (samme mønster som ComplianceNotifications)
   - **"Send nu"-knap** — kalder edge function med `?force=true` manuelt

2. Hooks i `useFmChecklist.ts` til config + modtagere CRUD

### Filer der oprettes/ændres
- **Ny:** `supabase/functions/send-checklist-daily-summary/index.ts`
- **Ændret:** `src/pages/vagt-flow/FmChecklistContent.tsx` (admin-sektion)
- **Ændret:** `src/hooks/useFmChecklist.ts` (nye hooks)
- **Database:** 2 nye tabeller + RLS + 1 cron-job

