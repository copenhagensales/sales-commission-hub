

# Faktura vs. System — Afvigelsesrapport

## Formål
Sammenlign faktureret omsætning (fra e-conomic konto 1010) med systemets registrerede omsætning (fra `get_sales_aggregates_v2`) per kunde per måned. Gør det muligt at se afvigelser.

## Ny tabel: `economic_client_mapping`

```sql
CREATE TABLE economic_client_mapping (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_pattern TEXT NOT NULL,
  client_id UUID REFERENCES clients(id),
  note TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```
RLS: Kun managers+ kan læse/skrive.

## Ny side: `/economic/revenue-match`

**Sektion A — Mapping-editor**
- Parser unikke tekst-præfikser fra konto 1010-posteringer (f.eks. "TDC ERHVERV", "EESY")
- Dropdown til at vælge intern kunde per præfiks
- Gem til `economic_client_mapping`

**Sektion B — Afvigelsestabel**
- Filtrér på år + måned(er)
- Tabel: Kunde | Faktureret (e-conomic) | System (mapped_revenue) | Afvigelse DKK | Afvigelse %
- Farvekodning: grøn (<5%), gul (5-15%), rød (>15%)
- Total-række

## Dataflow
1. Hent konto 1010-posteringer, match tekst mod `economic_client_mapping.match_pattern`
2. Hent system-omsætning via `get_sales_aggregates_v2` grupperet per client + date
3. Join og beregn afvigelse per kunde per måned

## Ændringer

| Fil | Handling |
|-----|---------|
| Migration | Opret `economic_client_mapping` med RLS |
| `src/pages/economic/EconomicRevenueMatch.tsx` | Ny side: mapping-editor + afvigelsestabel |
| `src/pages/economic/EconomicLayout.tsx` | Tilføj "Omsætning" tab med Scale-ikon |
| `src/hooks/useEconomicData.ts` | Tilføj hooks for client mapping CRUD + faktura-aggregering |
| `src/routes/config.tsx` + `pages.ts` | Tilføj route |

