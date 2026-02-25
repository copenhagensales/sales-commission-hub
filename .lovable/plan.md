
## Rabatstruktur: Minimum dage pr. lokation for at taelle som placering

### Problem
I dag taeller rabatsystemet for "Danske Shoppingcentre" alle bookinger som placeringer. Brugeren vil have, at en lokation kun taeller som 1 placering, hvis der er booket mindst 5 dage paa den lokation i perioden. Fx: Amager Centeret med 5 dage = 1 placering, Kolding Storcenter med 4 dage = 0 placeringer.

### Loesning
Tilfoej et `min_days_per_location` felt paa rabatreglerne og aendr beregningslogikken, saa "placeringer" taelles som unikke lokationer der opfylder minimumskravet.

### Teknisk plan

**Database-migration:**

Tilfoej kolonne `min_days_per_location` (default 1 for bagudkompatibilitet):

```sql
ALTER TABLE supplier_discount_rules
ADD COLUMN min_days_per_location integer NOT NULL DEFAULT 1;

-- Opdater Danske Shoppingcentre regler til 5 dage
UPDATE supplier_discount_rules
SET min_days_per_location = 5
WHERE location_type = 'Danske Shoppingcentre';
```

**Fil 1: `src/components/billing/SupplierReportTab.tsx`**

Aendring i placeringsberegningen (linje 244):

Erstat den nuvaerende `totalPlacements` (som taeller antal bookinger) med en beregning der:
1. For hver lokation, summer det faktiske antal bookede dage (via `booked_days` array eller fallback til `differenceInDays`)
2. Kun taeller lokationen som 1 placering hvis `totalDays >= min_days_per_location` (hentet fra discount rules)

```typescript
const minDaysPerLocation = discountRules?.[0]?.min_days_per_location ?? 1;
const totalPlacements = locationEntries.reduce((sum: number, loc: any) => {
  return sum + (loc.totalDays >= minDaysPerLocation ? 1 : 0);
}, 0);
```

Ogsaa sikre at `totalDays` beregnes fra `booked_days` array naar det er tilgaengeligt (som i Billing.tsx), saa vi faar det praecise antal dage.

**Fil 2: `src/components/billing/DiscountRulesTab.tsx`**

Tilfoej UI-felt til `min_days_per_location` i opret/rediger dialogen:
- Nyt input-felt "Min. dage pr. lokation" (kun synligt naar discount_type er "placements")
- Default vaerdi: 1
- Gem vaerdien ved opret/opdater

**Fil 3: `src/integrations/supabase/types.ts`**

Opdateres automatisk efter migrationen.

### Filer der aendres

| Fil | Aendring |
|---|---|
| Database | Tilfoej `min_days_per_location` kolonne, saet til 5 for Danske Shoppingcentre |
| `src/components/billing/SupplierReportTab.tsx` | Aendr placeringsoptaelling til unikke lokationer med nok dage |
| `src/components/billing/DiscountRulesTab.tsx` | Tilfoej min-dage felt i opret/rediger dialog |

### Resultat
- Danske Shoppingcentre: En lokation taeller kun som 1 placering hvis den har 5+ bookede dage
- Andre lokationstyper: Default 1 dag (ingen aendring i adfaerd)
- Konfigurerbart per rabattype via admin-UI
