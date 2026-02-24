

# Plan: Opdater lokationstyper i Kontaktpersoner-dropdown

## Problem

Dropdown-listen i `SupplierContactsTab.tsx` bruger en hardkodet liste med 5 gamle typer:
- Butik, Danske Shoppingcentre, Markeder, Ocean Outdoor, Storcenter

Men de aktuelle lokationstyper er 7:
- **Coop butik**, **Meny butik**, Danske Shoppingcentre, Markeder, Ocean Outdoor, **Messer**, **Anden lokation**

("Butik" er udgaaet og erstattet af "Coop butik" og "Meny butik". "Storcenter" er udgaaet.)

## Ændring

**Fil:** `src/components/billing/SupplierContactsTab.tsx`

Opdater `LOCATION_TYPES`-arrayet (linje 38-44) til:

```
"Coop butik"
"Meny butik"
"Danske Shoppingcentre"
"Markeder"
"Ocean Outdoor"
"Messer"
"Anden lokation"
```

Ingen andre filer eller database-ændringer er noedvendige.

