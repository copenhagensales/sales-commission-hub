

# Tilføj Lønsikring som bi-produkt (cross-sale) på ASE-salg

## Hvad ændres?
Når en sælger laver et ASE-salg med både A-kasse OG Lønsikring, registreres der i dag kun hovedproduktet "Salg" (1.000 kr). Lønsikringen ignoreres.

Med denne ændring vil salget stadig tælle som **1 salg**, men med **2 linjeposter**:
- Hovedprodukt: "Salg" -- 1.000 kr provision
- Bi-produkt: "Lønsikring Udvidet" -- 400 kr provision (via eksisterende pricing rule)
- **Samlet: 1.400 kr provision pr. salg**

Lønsikring-produktet er allerede opsat som "bi-salg" (counts_as_cross_sale = true), så det tæller ikke som et ekstra salg i statistikken.

## Hvad skal gøres?

### 1. Opdater ASE-integrationens konfiguration i databasen
Tilføj en ny conditional rule i `dialer_integrations.config` for ASE (id: `a76cf63a`). Den nye regel indsættes som nr. 2 i listen:

```text
Nuværende regler:
  1. Lønsikring (solo): A-kasse salg=Nej + Forening=Fagforening med lønsikring -> "Lønsikring"
  2. Lead: Ja-Afdeling=Lead -> "Lead"  
  3. Salg: Ja-Afdeling=Salg -> "Salg"

Nye regler:
  1. Lønsikring (solo): uændret
  2. NY: Lønsikring (bi-salg): Lønsikring != tom -> specific_fields med targetKey "Lønsikring" 
  3. Lead: uændret
  4. Salg: uændret
```

Den nye regel bruger `extractionType: "specific_fields"` med `targetKeys: ["Lønsikring"]`, som henter feltværdien (fx "Lønsikring Udvidet") direkte som produktnavn. Betingelsen er at feltet "Lønsikring" ikke er tomt.

### 2. Tilføj "not_empty" operator i Enreach-adapteren
`checkExtractionRuleConditions` skal understøtte en `not_empty` operator, der returnerer true hvis feltværdien eksisterer og ikke er tom. Det er en lille tilføjelse i switch-casen.

### 3. Kør re-sync for eksisterende salg
Efter ændringen trigges en sync for ASE-kampagnen, som genskaber sale_items med de nye regler. Eksisterende salg får derved tilføjet Lønsikring-biproduktet med korrekt provision.

## Tekniske detaljer

### Database-opdatering (SQL)
Opdater `config` JSONB-kolonnen i `dialer_integrations` for ASE-integrationen med den nye conditionalRule.

### Kodeændring: Enreach-adapter
Fil: `supabase/functions/integration-engine/adapters/enreach.ts`

Tilføj i `checkExtractionRuleConditions`-metoden support for operator `not_empty`:
```text
case "not_empty":
  return fieldValue !== undefined && fieldValue !== null && String(fieldValue).trim() !== "";
```

### Ingen frontend-ændringer
Bi-produkter vises allerede korrekt i salgsdetaljer og provisionsberegninger, da systemet summerer alle sale_items for et salg.

### Forventet resultat for Alexanders 9 salg d. 6. feb:
- 8 salg med "Fagforening med lønsikring": 2 sale_items hver (Salg 1.000 kr + Lønsikring 400 kr = 1.400 kr)
- 1 salg med "Ase Lønmodtager": 1 sale_item (Salg 600 kr, ingen Lønsikring)
- **Ny total: 8 x 1.400 + 1 x 600 = 11.800 kr** (op fra 8.600 kr)
