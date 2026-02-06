

# Plan: Ret ASE-salg med manglende prisregel-matching

## Problem identificeret

Der er **1.311 sale_items** i systemet hvor:
- `product_id` er sat korrekt (f.eks. til "Salg"-produktet)
- `needs_mapping = true` (fejlagtigt)
- `matched_pricing_rule_id = NULL`
- `mapped_commission = 0` og `mapped_revenue = 0`

Dette betyder at sælgere som Samuel Juul ikke får korrekt provision og salg vises ikke på straksbetalingssiden.

### Eksempel: Salg 42220506 (Marcus Pedersen)

Lead-data:
- A-kasse salg: Ja
- A-kasse type: Lønmodtager  
- Dækningssum: 6000

Burde matche reglen **"A-kasse uden straksbetaling over 6000 lønsikring"** (800 kr provision, 2.300 kr omsætning).

---

## Løsning: Engangskørsel af prisregel-rematching

### Trin 1: Opret edge function til rematching

Ny edge function `rematch-pricing-rules` der:
1. Henter alle sale_items uden `matched_pricing_rule_id` men med `product_id`
2. Henter tilhørende sale's `raw_payload.data`
3. Evaluerer alle aktive prisregler for produktet
4. Opdaterer `matched_pricing_rule_id`, `mapped_commission`, `mapped_revenue` og `needs_mapping`

### Trin 2: Kør funktionen for ASE-salg

Kører funktionen med filter på `source = 'ase'` for at rette alle 917 berørte salg.

---

## Teknisk implementation

### Ny edge function: rematch-pricing-rules

```text
Input: { source?: string, limit?: number, dry_run?: boolean }

Flow:
1. Hent sale_items WHERE matched_pricing_rule_id IS NULL AND product_id IS NOT NULL
2. Join med sales for at få raw_payload
3. Hent alle aktive prisregler grupperet efter product_id
4. For hver sale_item:
   a. Hent raw_payload.data fra salget
   b. Evaluer prisregler med matchPricingRule-logik
   c. Opdater sale_item med korrekte værdier
5. Returner statistik over rettede salg
```

### Prisregel-matching logik (kopieret fra sales.ts)

Funktionen bruger samme logik som `matchPricingRule`:
- Understøtter numeriske betingelser (`gte`, `lte`, `gt`, `lt`)
- Understøtter string-matches
- Sorterer regler efter prioritet

---

## Forventede resultater

| Kategori | Antal | Forventet efter |
|----------|-------|-----------------|
| Lønmodtager med A-kasse salg = Ja | 560 | Matches til A-kasse-regler |
| Leads (Ja - Afdeling = Lead) | 242 | Bevarer Lead-produktpris |
| Selvstændige | 17 | Ingen regel (ingen regler for selvstændige endnu) |

---

## Rettelse af integration engine (forebyggelse)

### Opdater sales.ts linje 296

```typescript
// Nuværende (fejl):
needs_mapping: !productId,

// Allerede korrekt - men product matching sker IKKE
// Problemet er at Enreach-adapter ikke sender products med korrekte navne
```

### Root cause

Enreach-adapteren genererer produktnavne som "akasse - Lønmodtager" i stedet for det simple "Salg", hvilket ikke matcher produktet i databasen ved navn-opslag. Produktmappingen sker kun via `adversus_product_mappings`-tabellen, som er tom for ASE.

### Permanent fix

Tilføj adversus_product_mappings for de genererede produktnavne, eller juster Enreach-adapterens produktekstraktion til at bruge de korrekte navne ("Salg" eller "Lead").

---

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `supabase/functions/rematch-pricing-rules/index.ts` | **NY** - Edge function til rematching |
| `supabase/functions/integration-engine/adapters/enreach.ts` | Evt. justering af produktnavne |

---

## Risiko og sikkerhed

- **Lav risiko**: Kun opdaterer `sale_items` med NULL-værdier
- **Dry-run mode**: Kan køres først uden ændringer for at verificere
- **Reversibel**: Kan nulstilles ved at køre med `commission_dkk: 0`

