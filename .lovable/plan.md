

# Test med visningsnavnet "cphsales2"

## Ændring
Opdater `supabase/functions/test-ase-leads/index.ts` til at bruge `cphsales2` i stedet for `cphsales` i alle URL'er.

## Teknisk detalje
Linje 48-50 i `test-ase-leads/index.ts` ændres:
- `searchName=cphsales` erstattes med `searchName=cphsales2` i alle tre URL-variationer.

Derefter deployes funktionen og testes med det samme.

