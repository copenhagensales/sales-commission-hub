

## Byg GDPR-compliance (5 dele)

### Oversigt
| # | Opgave | Filer |
|---|--------|-------|
| 1 | Art. 15 — automatisk dataudtræk | Ny edge function `gdpr-export-data/index.ts` |
| 2 | Art. 17 — automatisk sletningsworkflow | Ny edge function `gdpr-process-deletion/index.ts` |
| 4 | Sletningshistorik UI | `RetentionPolicies.tsx` |
| 5 | DPA-datoer i DataTransferRegistry | `DataTransferRegistry.tsx` |
| 6 | Kasper som ansvarlig person | `DataTransferRegistry.tsx` + `ComplianceOverview.tsx` |

---

### 1. Edge function: `gdpr-export-data`
Ny edge function der:
- Finder pending `export`-anmodninger i `gdpr_data_requests`
- For hver: henter medarbejderdata fra `employee_master_data`, `gdpr_consents`, `login_events`, `sales` (via agent_email mapping), `coaching tasks`, `absence_requests` osv.
- Samler alt i ét JSON-objekt
- Gemmer JSON som fil i Supabase Storage (bucket: `gdpr-exports`)
- Opdaterer `gdpr_data_requests.status = 'completed'` og sætter `completed_at`

Kan kaldes manuelt eller fra cron (cron aktiveres ikke nu).

**Database**: Tilføj `completed_at timestamptz` og `export_file_url text` kolonner til `gdpr_data_requests`.

### 2. Edge function: `gdpr-process-deletion`
Ny edge function der:
- Finder pending `deletion`-anmodninger i `gdpr_data_requests`
- For hver medarbejder: anonymiserer PII i `employee_master_data` (first_name → "Slettet", last_name → "Bruger", email → null, phone → null, cpr_number → null osv.)
- Sletter tilknyttede data: `login_events`, `gdpr_consents`, `communication_logs`
- Bevarer historisk salgsdata (sælgernavn bevares til rapporter)
- Opdaterer status til `completed`

### 3. Sletningshistorik UI (punkt 4)
Tilføj en ny Card-sektion nederst på `RetentionPolicies.tsx`:
- Hent seneste rækker fra `audit_logs` hvor `action = 'gdpr_data_cleanup'`
- Vis tabel: tidspunkt, antal anonymiserede, antal slettede, detaljer (collapsed JSON)
- Viser "Ingen kørsler endnu" når tom

### 4. DPA-datoer (punkt 5)
Opdater `DataTransferRegistry.tsx`:
- Tilføj `connectedDate` felt til hvert transfer-objekt med datoen de blev koblet til systemet
- Tilføj "Tilsluttet"-kolonne i tabellen
- Datoer baseret på hvornår systemet blev sat op (alle ca. juni-juli 2025 baseret på migrationshistorik)

### 5. Kasper som ansvarlig (punkt 6)
- Tilføj en "GDPR-ansvarlig"-kort i `DataTransferRegistry.tsx` med Kaspers navn og kontaktinfo
- Tilføj også en reference til GDPR-ansvarlig i `ComplianceOverview.tsx` header-area

---

### Fil-ændringer

| Fil | Ændring |
|-----|---------|
| `supabase/functions/gdpr-export-data/index.ts` | **Ny** — eksport af medarbejderdata som JSON |
| `supabase/functions/gdpr-process-deletion/index.ts` | **Ny** — automatisk sletning/anonymisering |
| `gdpr_data_requests` tabel | Migration: tilføj `completed_at`, `export_file_url` kolonner |
| Storage bucket `gdpr-exports` | Migration: opret bucket |
| `src/pages/compliance/RetentionPolicies.tsx` | Tilføj "Sletningshistorik" sektion |
| `src/pages/compliance/DataTransferRegistry.tsx` | Tilføj DPA-datoer + GDPR-ansvarlig kort |
| `src/pages/compliance/ComplianceOverview.tsx` | Tilføj GDPR-ansvarlig reference |

