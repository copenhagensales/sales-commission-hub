

## Liga vs Dagsrapporter: Hvorfor tallene ikke stemmer

### Identificerede forskelle

Jeg har sammenlignet `league-calculate-standings` med `DailyReports.tsx` og fundet **to væsentlige forskelle**:

**1. FM-salg ignoreres i ligaen**
- **Dagsrapporter**: Henter FM-salg separat via `raw_payload.fm_seller_id` (direkte employee_id match)
- **Liga**: Matcher KUN via `agent_email` — FM-salg har typisk ingen agent_email der matcher medarbejderens email-mappings, så de bliver aldrig talt med

**2. Liga filtrerer rejected salg fra — Dagsrapporter gør ikke**
- **Liga**: `.or("validation_status.neq.rejected,validation_status.is.null")`
- **Dagsrapporter**: Ingen filter på `validation_status` overhovedet — alle salg tælles med

### Plan

**Fil:** `supabase/functions/league-calculate-standings/index.ts`

| Ændring | Detalje |
|---------|---------|
| Fjern validation_status filter | Dagsrapporter filtrerer ikke, så ligaen skal heller ikke. Matcher "én sandhed" |
| Tilføj FM-salg via fm_seller_id | Hent FM-salg separat (`source = 'fieldmarketing'`), match til employee via `raw_payload->>'fm_seller_id'`, brug `sale_items.mapped_commission` |

```text
Nuværende flow:
  ALL sales → match by agent_email → sum sale_items.mapped_commission

Nyt flow:
  TM sales (source != fieldmarketing) → match by agent_email → sum sale_items.mapped_commission
  FM sales (source = fieldmarketing) → match by raw_payload.fm_seller_id → sum sale_items.mapped_commission
  → Combine totals per employee
```

Samme ændring bør også laves i `league-process-round/index.ts` da den bruger identisk logik for aktive runder.

**Filer:**
- `supabase/functions/league-calculate-standings/index.ts`
- `supabase/functions/league-process-round/index.ts`

