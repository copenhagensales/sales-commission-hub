
## Opret nyt produkt "Loensikring" for ASE

### Baggrund
Billedet viser et HeroBase-salg med felterne "A-kasse salg: Nej" og "Forening: Fagforening med loensikring". Naar begge disse betingelser er opfyldt, skal produktet udtraekkes som "Loensikring" i stedet for det nuvaerende "Salg".

### AEndringer

**1. Opret produktet i databasen**

Indsaet et nyt produkt "Loensikring" under ASE-kampagnen (Ase Products: `df34d982-07b7-4246-8229-0d703318ad28`) med 0 kr i provision og omsaetning (du saetter selv priserne op via produkt-mapping).

**2. Opdater ASE integrationskonfigurationen**

Tilfoej en ny conditional rule i ASE-integrationens `config.productExtraction.conditionalRules` med:
- Betingelse 1: "A-kasse salg" equals "Nej"
- Betingelse 2: "Forening" equals "Fagforening med loensikring"
- Produktnavn: "Loensikring"
- Extraction type: static_value

Reglen placeres FOER de eksisterende "Salg" og "Lead" regler, saa den fanger loensikrings-salg foer den generelle "Salg"-regel.

### Opdateret regelraekkefoelge

```text
Regel 1 (NY):  A-kasse salg = Nej  OG  Forening = Fagforening med loensikring  ->  "Loensikring"
Regel 2:       Ja - Afdeling = Lead                                              ->  "Lead"
Regel 3:       Ja - Afdeling = Salg                                              ->  "Salg"
```

### Teknisk detalje

Opdateringen sker via en UPDATE paa `dialer_integrations.config` JSONB-feltet for ASE-integrationen (`a76cf63a-4b02-4d99-b6b5-20a8e4552ba5`). Ingen kodeaendringer er noedvendige - kun databasedata aendres.

Derefter kan du saette provision og omsaetning op via produktmapping i brugerfladen.
