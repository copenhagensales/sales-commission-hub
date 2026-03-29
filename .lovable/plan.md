

## Plan: Tilføj dialer-retention felt og "ingen data" markering

### Overblik
1. Nyt felt `dialer_retention_days` (integer, default 180) på `data_field_definitions` — rent dokumentationsformål
2. Nyt felt `no_data_held` (boolean, default false) på `campaign_retention_policies` — markerer at vi ikke opbevarer kundedata for den kampagne

### Database migration

```sql
-- Tilføj dialer retention felt (standard 6 mdr = 180 dage)
ALTER TABLE public.data_field_definitions
  ADD COLUMN dialer_retention_days integer DEFAULT 180;

-- Tilføj "ingen data" flag på kampagne-retention
ALTER TABLE public.campaign_retention_policies
  ADD COLUMN no_data_held boolean NOT NULL DEFAULT false;
```

### UI-ændringer

**`src/components/mg-test/FieldDefinitionDialog.tsx`**
- Tilføj nyt felt "Dialer retention (dage)" under det eksisterende retention-felt
- FormDescription: "Standard opbevaringsperiode i dialer (default 180 dage / 6 mdr). Kun til dokumentation."
- Opdater form schema og mutation

**`src/components/mg-test/FieldDefinitionsManager.tsx`**
- Opdater `FieldDefinition` interface med `dialer_retention_days: number | null`
- Tilføj kolonne "Dialer ret." i tabellen med ikon og dage-visning
- Vis "6 mdr" for 180 dage osv.

**`src/pages/compliance/RetentionPolicies.tsx`**
- I kampagnetabellen: tilføj en "Ingen data" kolonne med en `Switch` eller `Checkbox`
- Når `no_data_held` er true: vis badge "Ingen data opbevaret", og gør retention/rensning felter disabled/dimmed
- Upsert mutation opdateres til at inkludere `no_data_held`

### Filer

| Fil | Ændring |
|-----|---------|
| `supabase/migrations/...` | Tilføj `dialer_retention_days` + `no_data_held` |
| `src/components/mg-test/FieldDefinitionDialog.tsx` | Nyt formfelt for dialer retention |
| `src/components/mg-test/FieldDefinitionsManager.tsx` | Ny kolonne + interface |
| `src/pages/compliance/RetentionPolicies.tsx` | "Ingen data" toggle per kampagne |

