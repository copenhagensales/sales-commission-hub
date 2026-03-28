

## Tilføj kundehenvendelser til Sletningspolitikker

### Koncept
Tilføj en ny sektion på RetentionPolicies-siden for "Øvrige datatyper" — startende med `customer_inquiries`. Disse er ikke kampagne-baserede, så de kræver deres egen tabel.

### Database
Ny tabel `data_retention_policies`:

| Kolonne | Type | Default |
|---------|------|---------|
| id | uuid | gen_random_uuid() |
| data_type | text (UNIQUE) | — |
| display_name | text | — |
| retention_days | integer | null |
| is_active | boolean | false |
| cleanup_mode | text | 'delete_all' |
| created_at | timestamptz | now() |
| updated_at | timestamptz | now() |

RLS: Samme mønster som `campaign_retention_policies` (owner/manager).

Seed med én række: `data_type = 'customer_inquiries'`, `display_name = 'Kundehenvendelser'`.

### Frontend (RetentionPolicies.tsx)
Tilføj en ny sektion **under** kampagnetabellen:
- Overskrift: "Øvrige datatyper"
- Samme tabel-layout: Navn, Retention (dage), Rensningstype (kun "Slet alt" for inquiries — der er ingen forretningsdata at bevare), Aktiv-switch
- Fetcher fra `data_retention_policies` og upsert'er på `data_type`

### Tekniske ændringer
1. **Migration**: Opret `data_retention_policies` med RLS + seed `customer_inquiries`-rækken
2. **RetentionPolicies.tsx**: Tilføj useQuery + mutation for `data_retention_policies`, render ny sektion med tabel

### Risiko
Ingen. Kun UI og konfiguration. Cleanup-jobbet læser ikke fra denne tabel endnu.

