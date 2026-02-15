

# Delvis annullering af produkter med quantity > 1

## Problem
Naar et produkt har quantity > 1 (fx 6 stk), vises det som en enkelt raekke med kun en "Annuller"-knap der annullerer alle 6 paa en gang. Brugeren oensker at kunne annullere fx 1 ud af 6.

## Loesning

### Trin 1: Database-migration
Tilfoej en `cancelled_quantity` kolonne til `sale_items`:

```text
ALTER TABLE sale_items 
ADD COLUMN cancelled_quantity integer NOT NULL DEFAULT 0;
```

Dette erstatter den binaere `is_cancelled`-tilgang med en taeller, saa man kan annullere 1, 2, 3... op til det fulde antal.

### Trin 2: Opdater CancellationDialog

**Visning per produkt-raekke:**
- Vis produktnavn, total antal, provision pr. stk (beregnet som `mapped_commission / quantity`), og antal allerede annulleret
- Vis "Annuller 1 stk"-knap saa laenge `cancelled_quantity < quantity`
- Naar `cancelled_quantity == quantity`, vis "Annulleret" badge (som nu)
- Opdater `is_cancelled` til `true` automatisk naar `cancelled_quantity == quantity`

**Annuller-handling (per klik):**
- Oejer `cancelled_quantity` med 1
- Hvis `cancelled_quantity` naar `quantity`, saet ogsaa `is_cancelled = true`

**"Annuller hele salget"-knappen:**
- Saetter `cancelled_quantity = quantity` og `is_cancelled = true` for alle items
- Saetter `sales.validation_status = 'cancelled'`

### Trin 3: Tilpas provision-visning
Da `mapped_commission` er prae-multipliceret med quantity, beregnes provision pr. stk som:
```text
per_unit_commission = mapped_commission / quantity
```
Vis baade total provision og antal annulleret, fx:
- "6900 kr (6 stk)" med info om "2 annulleret"

### Tekniske detaljer

**Nye kolonner:**
```text
sale_items.cancelled_quantity (integer, default 0)
```

**Filer der aendres:**
- `src/components/cancellations/CancellationDialog.tsx` - ny UI-logik for delvis annullering
- Database migration for `cancelled_quantity`

**Kompatibilitet:**
- `is_cancelled` bevares og saettes automatisk naar alle enheder er annulleret
- Eksisterende logik der checker `is_cancelled` fortsaetter med at fungere

