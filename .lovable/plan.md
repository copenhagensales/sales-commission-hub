

# Fix: ASE data og omsaetning mangler efter /leads migration

## Resumé

Migrationen til `/leads` endpointet har introduceret 3 problemer pga. lowercase data-keys:

1. **Kundedata mangler**: `customer_phone` og `customer_name` er tomme fordi `getStr()` soeger efter `Telefon1`, `Navn1` osv., men `/leads` returnerer `telefon1`, `navn1`
2. **Pricing rules matcher ikke**: Regler forventer `A-kasse salg`, `Daekningssum`, `Forening` -- men data har `a-kasse salg`, `daekningssum`, `forening`
3. **Loensikring produkt-mismatch**: Extraction-reglen henter vaerdien "Loensikring Udvidet" som produktnavn, men pricing rules kun findes for "Loensikring"

## Loesung

### Trin 1: Tilfoej key-normalisering i enreach.ts adapteren

Tilfoej en `normalizeLeadsData()` metode der Title Case-konverterer alle data-keys naar `/leads` endpointet bruges. Kald den i `buildStandardSale()` foer data bruges.

```text
Input:   { "a-kasse salg": "Ja", "daekningssum": "6000", "telefon1": "12345678" }
Output:  { "A-Kasse Salg": "Ja", "Daekningssum": "6000", "Telefon1": "12345678" }
```

Vigtig detalje: Brug en praecis mapping for kendte felter i stedet for generisk Title Case, da `A-kasse salg` (kun foerste ord capitalized) er det format pricing rules forventer -- ikke `A-Kasse Salg`.

Kendte felter der skal mappes:
- `a-kasse salg` -> `A-kasse salg`
- `a-kasse type` -> `A-kasse type`
- `daekningssum` -> `Dækningssum`
- `forening` -> `Forening`
- `loensikring` -> `Lønsikring`
- `eksisterende medlem` -> `Eksisterende medlem`
- `medlemsnummer` -> `Medlemsnummer`
- `nuvaerende a-kasse` -> `Nuværende a-kasse`
- `resultat af samtalen` -> `Resultat af samtalen`
- `ja - afdeling` -> `Ja - Afdeling`
- `leadudfald` -> `Leadudfald`
- `navn1` -> `Navn1`
- `navn2` -> `Navn2`
- `telefon1` -> `Telefon1`

Fallback for ukendte keys: capitalize foerste bogstav.

Normaliseringen skal ogsaa gemmes i `raw_payload.data` saa rematch-pricing-rules kan matche korrekt.

### Trin 2: Opdater ASE integration config (Loensikring)

Opdater `dialer_integrations.config` for ASE (id: `a76cf63a-4b02-4d99-b6b5-20a8e4552ba5`). AEndr conditional rule #2:

- **Fra**: `extractionType: "specific_fields"` med `targetKeys: ["Loensikring"]`
- **Til**: `extractionType: "static_value"` med `staticProductName: "Loensikring"`

### Trin 3: Ret eksisterende data

1. Opdater `sale_items` med `product_id = 'e1d43ddb-4340-4066-a1b8-b699d837f4ce'` (Loensikring Udvidet) til `product_id = 'f9a8362f-3839-4247-961c-d5cd1e7cd37d'` (Loensikring)
2. Normaliser `raw_payload.data` keys for eksisterende ASE-salg der har lowercase keys (de nyeste ~623 salg uden telefon)
3. Koer `rematch-pricing-rules` for at genberegne commission/revenue

### Trin 4: Deploy og test

1. Deploy opdateret `integration-engine`
2. Trigger ASE sync og verificer at nye salg faar:
   - `customer_phone` udfyldt
   - `customer_name` udfyldt
   - Korrekt `mapped_commission` og `mapped_revenue`
   - Loensikring-items med product_id `f9a8362f`

## Tekniske detaljer

### Fil: `supabase/functions/integration-engine/adapters/enreach.ts`

Tilfoej ny metode `normalizeLeadsData(data: Record<string, string>): Record<string, string>` med explicit key-mapping. Kald den i `buildStandardSale()` efter linje ~707 naar `this.usesLeadsEndpoint` er true:

```text
if (this.usesLeadsEndpoint && dataObj) {
  dataObj = this.normalizeLeadsData(dataObj);
  // Also update the raw lead.data so raw_payload gets normalized keys
  lead.data = dataObj;
}
```

### Database: Opdater eksisterende salg

SQL til at normalisere lowercase keys i eksisterende raw_payload og rette Loensikring product_id.

### Edge function kald: rematch-pricing-rules

Kald med `source: "ase"` for at genberegne alle ASE sale_items.

