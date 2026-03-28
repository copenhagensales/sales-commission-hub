

## Tilføj "Bevar forretningsdata" til Sletningspolitikker

### Koncept
Udvid den (endnu ikke byggede) RetentionPolicies-side med en valgmulighed per kampagne: **"Anonymisér kun kundedata"** vs. **"Slet alt"**.

Når "Anonymisér kun kundedata" er valgt, vil cleanup-jobbet (når det aktiveres) kun nulle PII-felter mens forretningsdata bevares:

```text
BEVARES                          ANONYMISERES
─────────────────                ──────────────────
sale_datetime                    customer_phone → null
agent_name / agent_email         customer_company → "Anonymiseret"
product, quantity                normalized_data → kun PII-nøgler fjernes
mapped_commission                raw_payload → null
mapped_revenue                   
client_campaign_id               
source, validation_status        
```

### Database

Udvid `campaign_retention_policies`-tabellen (som også endnu ikke er oprettet) med en ekstra kolonne:

| Kolonne | Type | Default |
|---------|------|---------|
| cleanup_mode | text ('anonymize_customer' / 'delete_all') | 'anonymize_customer' |

Fuld tabel bliver:
- `id`, `client_campaign_id` (FK, UNIQUE), `retention_days`, `is_active` (default false), `cleanup_mode` (default 'anonymize_customer'), `created_at`, `updated_at`

### Frontend (RetentionPolicies.tsx)

Per kampagne-række i tabellen:
- **Retention dage** — input-felt
- **Aktiv/Inaktiv** — Switch (default: off)
- **Rensningstype** — Select/dropdown med to valg:
  - "Anonymisér kundedata" (default) — kun PII fjernes, forretningsdata bevares
  - "Slet alt" — hele rækken renses
- Info-boks øverst forklarer forskellen med en tabel som ovenfor

### Ændringer samlet

Da RetentionPolicies-siden og tabellen endnu ikke er bygget, samler vi det hele i ét trin:

1. **Migration**: Opret `campaign_retention_policies` med alle kolonner inkl. `cleanup_mode`
2. **Ny side**: `src/pages/compliance/RetentionPolicies.tsx` med kampagneoversigt, retention-dage, aktiv-switch, og cleanup-mode dropdown
3. **Route + navigation**: Tilføj i `routes/config.tsx`, `routes/pages.ts`, og `ComplianceOverview.tsx`
4. **`gdpr-data-cleanup` ændres IKKE** — den vil først læse `cleanup_mode` når I aktiverer

### Risiko
Ingen. Kun UI og en tom tabel. Ingen data slettes.

