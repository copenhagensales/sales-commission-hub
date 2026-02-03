

## Opdatering af ASE produkt-ekstraktionsregler

### Oversigt
Tilføj to nye regler til ASE-integrationen, der konverterer "Ja - Afdeling" værdier til produktnavne:
- "Ja - Afdeling" = "Lead" → Produktnavn "Lead"
- "Ja - Afdeling" = "Salg" → Produktnavn "Salg"

---

### Nuværende konfiguration
ASE-integrationen har i dag disse regler:
1. A-kasse salg = Ja + A-kasse type er udfyldt → "akasse - {{A-kasse type}}"
2. Forening = "Fagforening med lønsikring" → "Fagforening med lønsikring"
3. Lønsikring er udfyldt → "{{Lønsikring}}"

### Nye regler der tilføjes
4. **Ja - Afdeling = "Lead"** → Produktnavn "Lead"
5. **Ja - Afdeling = "Salg"** → Produktnavn "Salg"

---

### Implementering

#### Databaseopdatering
Opdater `config.productExtraction.conditionalRules` i `dialer_integrations` tabellen for ASE:

```json
{
  "conditionalRules": [
    // Eksisterende regel 1: A-kasse
    {
      "conditions": [
        {"field": "A-kasse salg", "operator": "equals", "value": "Ja"},
        {"field": "A-kasse type", "operator": "isNotEmpty", "value": ""}
      ],
      "conditionsLogic": "AND",
      "extractionType": "composite",
      "productNameTemplate": "akasse - {{A-kasse type}}"
    },
    // Eksisterende regel 2: Fagforening med lønsikring
    {
      "conditions": [
        {"field": "Forening", "operator": "equals", "value": "Fagforening med lønsikring"}
      ],
      "extractionType": "static_value",
      "staticProductName": "Fagforening med lønsikring"
    },
    // Eksisterende regel 3: Lønsikring
    {
      "conditions": [
        {"field": "Lønsikring", "operator": "isNotEmpty", "value": ""}
      ],
      "extractionType": "composite",
      "productNameTemplate": "{{Lønsikring}}"
    },
    // NY REGEL 4: Ja - Afdeling = Lead
    {
      "conditions": [
        {"field": "Ja - Afdeling", "operator": "equals", "value": "Lead"}
      ],
      "extractionType": "static_value",
      "staticProductName": "Lead"
    },
    // NY REGEL 5: Ja - Afdeling = Salg
    {
      "conditions": [
        {"field": "Ja - Afdeling", "operator": "equals", "value": "Salg"}
      ],
      "extractionType": "static_value",
      "staticProductName": "Salg"
    }
  ]
}
```

---

### Tekniske detaljer

#### Regelrækkefølge
Integrationen evaluerer reglerne i rækkefølge og kan matche flere regler samtidig (break blev fjernet i koden). Et salg kan derfor få flere produkter, f.eks.:
- "akasse - Lønmodtager" OG "Salg" (hvis begge regler matcher)

#### Eksisterende lead-data bekræfter feltnavnet
```
"Ja - Afdeling": "Salg"   // Fra lead_data
"Ja - Afdeling": "Lead"   // Fra lead_data
```

#### Udførsel
1. SQL-migration opdaterer ASE-konfigurationen
2. Næste sync (hvert 5. minut) vil anvende de nye regler
3. Produkter "Lead" og "Salg" skal evt. oprettes i produkttabellen for at kunne matches

---

### Filer der ændres
1. **Database migration** - Opdatering af ASE `dialer_integrations.config`

