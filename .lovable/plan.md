

## Opdater gdpr-data-cleanup til at bruge retention-politikker

### Hvad sker der
Edge function'en `gdpr-data-cleanup` omskrives til at læse fra de to policy-tabeller (`campaign_retention_policies` og `data_retention_policies`) og implementere begge rensningstyper. Alt forbliver **deaktiveret** — kun politikker med `is_active = true` behandles, og ingen er aktive endnu.

### Ny logik i edge function

**Del 1 — Kampagnebaseret salgsdata:**
1. Hent aktive rækker fra `campaign_retention_policies` (med `is_active = true`)
2. For hver: beregn cutoff = `now() - retention_days`
3. Hent sales hvor `client_campaign_id` matcher og `sale_datetime < cutoff`
4. Baseret på `cleanup_mode`:
   - `anonymize_customer`: Sæt `customer_phone → null`, `customer_company → 'Anonymiseret'`, `raw_payload → null`
   - `delete_all`: Slet hele rækken

**Del 2 — Øvrige datatyper:**
1. Hent aktive rækker fra `data_retention_policies` (med `is_active = true`)
2. For hver `data_type`, beregn cutoff og kør cleanup:
   - `customer_inquiries`: Slet rækker fra `customer_inquiries` hvor `created_at < cutoff`
   - `candidates`: Anonymisér (som nu) eller slet kandidater hvor `updated_at < cutoff` og status er afsluttet
   - `inactive_employees`: Slet fra `employee_master_data` hvor `is_active = false` og `employment_end_date < cutoff`

**Del 3 — Audit log:** Skriv samlet resultat til `audit_logs` som nu.

### Hvad bevares
- Den eksisterende field-level cleanup (Part 1 i nuværende kode) beholdes som-den-er
- Kandidat-hardcoded 6-måneders logik erstattes af `data_retention_policies`-opslaget

### Fil-ændringer
| Fil | Ændring |
|-----|---------|
| `supabase/functions/gdpr-data-cleanup/index.ts` | Omskriv til at læse fra policy-tabeller og implementere `anonymize_customer` + `delete_all` |

### Sikkerhed
- Bruger allerede `SUPABASE_SERVICE_ROLE_KEY` (korrekt for baggrundsjob)
- Ingen data slettes medmindre en politik er sat til `is_active = true` — og ingen er det endnu

