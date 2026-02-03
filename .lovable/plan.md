

## Opdater ASE produkt-ekstraktionsregler

### Problem
Lead-dataene indeholder flere felter der matcher eksisterende regler:
- `Forening: "Fagforening med lønsikring"` → matcher regel 2
- `Lønsikring: "Lønsikring Udvidet"` → matcher regel 3  
- `Ja - Afdeling: "Salg"` → matcher regel 5

Alle tre regler matcher, og derfor oprettes tre produkter i stedet for kun "Salg".

### Løsning
Fjern de gamle regler (Fagforening med lønsikring, Lønsikring, A-kasse) og behold kun de to nye regler baseret på "Ja - Afdeling":

| Regel | Betingelse | Produkt |
|-------|-----------|---------|
| 1 | Ja - Afdeling = "Lead" | Lead |
| 2 | Ja - Afdeling = "Salg" | Salg |

### Implementering

**Database opdatering:**
Opdater ASE-integrationen til kun at have de to "Ja - Afdeling" regler:

```json
{
  "conditionalRules": [
    {
      "conditions": [{"field": "Ja - Afdeling", "operator": "equals", "value": "Lead"}],
      "extractionType": "static_value",
      "staticProductName": "Lead"
    },
    {
      "conditions": [{"field": "Ja - Afdeling", "operator": "equals", "value": "Salg"}],
      "extractionType": "static_value",
      "staticProductName": "Salg"
    }
  ]
}
```

### Efter opdatering
- Eksisterende salg skal resynces for at fjerne de forkerte produkter
- Nye salg vil kun få ét produkt baseret på "Ja - Afdeling" værdien

