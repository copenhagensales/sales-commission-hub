

## Plan: Fix kampagne-retention — to retentionsfelter + "ingen dialer-data" ændring

### Problem
1. "Ingen data" toggle blokerer hele rækken (opacity + disabled felter) — forkert. Det skal kun betyde "vi har ingen dialer-data" (kunden bruger eget system), ikke at vi ikke har data overhovedet.
2. Der mangler et separat felt til dialer-retention (dage). Der er to forskellige intervaller: vores system og dialerens.

### Ændringer

**Database migration** — Tilføj `dialer_retention_days` kolonne
```sql
ALTER TABLE public.campaign_retention_policies
  ADD COLUMN dialer_retention_days integer DEFAULT 180;
```

**`src/pages/compliance/RetentionPolicies.tsx`**
1. **Fjern opacity/disabled-logik** fra "Ingen data" toggle — rækken skal aldrig dimmes eller blokeres
2. **Omdøb "Ingen data"** til "Ingen dialer-data" med tooltip: "Kunden bruger eget system — vi ringer ikke ud fra vores dialer"
3. **Tilføj kolonne "Dialer ret. (dage)"** — et separat input-felt til dialer-retention (default 180)
4. **Omdøb eksisterende "Retention (dage)"** til "Vores retention (dage)" for klarhed
5. Når "Ingen dialer-data" er slået til: kun dialer-retention feltet disables (ikke resten)
6. Opdater `RetentionPolicy` interface + upsert mutation med `dialer_retention_days`

### Filer

| Fil | Ændring |
|-----|---------|
| `supabase/migrations/...` | Tilføj `dialer_retention_days` på `campaign_retention_policies` |
| `src/pages/compliance/RetentionPolicies.tsx` | To retention-felter, ændret "ingen data" semantik |

