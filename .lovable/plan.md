

# Fix: Telefonnumre for alle integrationer fremadrettet

## Problem
Enreach-adapteren (`mapLeadToSale`) søger kun telefonnummer i 4 felter: `Telefon1`, `Telefon`, `Phone`, `Mobile`. Men forskellige kunder bruger forskellige feltnavne:

| Klient | Felt med telefonnr. | Nuværende match? |
|--------|---------------------|------------------|
| Tryg | `Telefon1` | ✅ Ja |
| Eesy | `contact_number`, `SUBSCRIBER_ID`, `Telefon Abo1` | ❌ Nej |
| ASE | Sandsynligvis samme som Eesy | ❌ Nej |

Adversus er allerede fixet (henter phone fra lead-data via `buildLeadDataMap`).

## Løsning

### `supabase/functions/integration-engine/adapters/enreach.ts` — `mapLeadToSale` (~linje 771)

Udvid listen af telefon-feltnavne der søges i:

```typescript
// Nuværende:
customerPhone = this.getStr(dataObj, ["Telefon1", "Telefon", "Phone", "Mobile"]);

// Nyt:
customerPhone = this.getStr(dataObj, [
  "Telefon1", "Telefon", "Phone", "Mobile",
  "contact_number", "SUBSCRIBER_ID", "Telefon Abo1",
  "phoneNumber", "PhoneNumber", "Mobilnummer"
]);
```

Det er hele ændringen — én linje udvides med flere feltnavne. Dækker alle kendte Enreach-klienter (Tryg, Eesy, ASE).

### Resultat
- Alle fremtidige Enreach-salg (Eesy, ASE) får telefonnummer ved import
- Tryg fungerer allerede
- Adversus er allerede fixet
- Ingen ekstra API-kald

| Fil | Ændring |
|-----|---------|
| `supabase/functions/integration-engine/adapters/enreach.ts` | Udvid telefon-feltnavne i `mapLeadToSale` |

