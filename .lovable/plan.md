# Fix: Umappede salg vises ikke under "Manglende mapping"

## Problem

Banneret øverst på MG Test viser **"379 salg mangler produktmapping (seneste 30 dage)"**, men selve "Manglende mapping"-tabellen i Mapping produkt-fanen er tom.

## Root cause

Database-funktionen `get_aggregated_product_types` returnerer kun **én** række pr. (adversus_external_id, adversus_product_title) via `DISTINCT ON`. Sortering prioriterer rækker hvor `product_id IS NOT NULL`:

```sql
ORDER BY
  si.adversus_external_id,
  si.adversus_product_title,
  CASE WHEN si.product_id IS NOT NULL THEN 0 ELSE 1 END,  -- mappet vinder
  si.created_at DESC
```

Resultat: hvis blot ét salg med samme titel har en mapping, "vinder" den mappede række, og de umappede salg forsvinder fra listen. RPC'en returnerer kun **9 umappede produkt-grupper**, selvom der er **379 sale_items uden mapping** fordelt på ~10+ unikke titler.

Eksempler på titler der er skjult i dag:
- `Meeting -- AE_1_police` (263 umappede)
- `Meeting -- AE_permision` (73 umappede)
- `TRYG SMS - Finansforbundet` (24 umappede)
- `Fri tale + 100 GB data (5G) (6 mdr. binding)` (3 umappede)

## Fix

Opdatér `DISTINCT ON` til også at gruppere på `(product_id IS NULL)`. Så får vi to separate rækker pr. titel hvis både mappede og umappede varianter findes — og umappede salg dukker korrekt op under "Manglende mapping" gruppen i UI.

```sql
DISTINCT ON (
  si.adversus_external_id,
  si.adversus_product_title,
  (si.product_id IS NULL)   -- ny: separer mappet vs. umappet
)
...
ORDER BY
  si.adversus_external_id,
  si.adversus_product_title,
  (si.product_id IS NULL),
  si.created_at DESC
```

## Berørte filer

- **Migration (DB):** Opdater funktionen `public.get_aggregated_product_types()`. Rød zone (pricing-relaterede mapping-flows) — derfor afgrænset til denne ene RPC, ingen andre tabeller eller funktioner.
- **Frontend:** Ingen ændringer. `aggregatedProducts`-logikken i `src/pages/MgTest.tsx` håndterer allerede rækker uden `product_id` korrekt (linje 652-669) — de placeres automatisk i "Manglende mapping"-gruppen via `clientId ?? "unmapped"`-routing.

## Forventet resultat

Efter fix:
- "Manglende mapping"-gruppen viser ~10+ produkter (én pr. unik titel uden mapping)
- Banner-tællingen og listen stemmer overens
- Eksisterende mappede produkter vises uændret i deres respektive kunde-grupper
