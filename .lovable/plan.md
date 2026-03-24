

# Fix: "Ocean Outdoor" mangler i type-filter på Fakturering

## Problem
Type-dropdown'en på Billing-siden er **dynamisk genereret** fra de bookinger der findes i den valgte periode (linje 112-114):
```typescript
const locationTypes = [...new Set(
  bookings?.map((b: any) => b.location?.type).filter(Boolean) || []
)];
```
Hvis der ingen Ocean Outdoor-bookinger er i den valgte måned, vises typen slet ikke i filteret.

## Løsning

| Fil | Hvad |
|-----|------|
| `src/pages/vagt-flow/Billing.tsx` | Erstat den dynamiske `locationTypes` med en fast liste der matcher de kendte typer fra Locations-siden: `Coop butik`, `Meny butik`, `Danske Shoppingcentre`, `Ocean Outdoor`, `Markeder`, `Messer`, `Anden lokation`. Behold dynamiske typer som fallback (merge) så eventuelle nye typer også dukker op. |

Konkret: linje 112-114 ændres til en kombination af hardcodede typer + unikke typer fra data, så alle typer altid er synlige uanset om der er bookinger i perioden.

