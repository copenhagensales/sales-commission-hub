

# Tilføj fakturanumre i afvigelsesrapporten

## Ændring
Udvid `deviationData` til også at samle de relevante `faktura_nr`-værdier per kunde+måned, og vis dem i tabellen.

## Teknisk

### 1. Saml fakturanumre i aggregeringen (linje ~272-282)
Tilføj en parallel map `invoicesByClientMonth: Record<string, Record<string, Set<string>>>` der samler unikke `faktura_nr` per client+month.

### 2. Udvid row-typen (linje ~289-291)
Tilføj `invoiceNrs: string[]` til row-objektet.

### 3. Vis i tabellen (linje ~688-712)
- Tilføj kolonne `Fakturanr.` i header
- Vis komma-separerede fakturanumre i hver række
- Opdatér total-rækken med `colSpan` tilsvarende

## Fil
`src/pages/economic/EconomicRevenueMatch.tsx`

