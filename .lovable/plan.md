

## Redigerbar point/salg + split Tryg/Codan

### Ændringer

**1. Gør "Point/salg" redigerbar på input-siden (`PowerdagInput.tsx`)**
- Erstat det statiske tal i "Point/salg"-kolonnen med et inline `<Input>` felt
- Ved blur gemmes den nye værdi direkte til `powerdag_point_rules` tabellen
- Refetch rules efter ændring så beregningen opdateres live

**2. Split "Tryg/Codan" til to separate linjer (database)**
- Slet den eksisterende "Tryg/Codan" regel (id: `fb9a9fff-...`)
- Opret to nye regler under United:
  - "Tryg" — 0.4 point/salg
  - "Codan" — 0.4 point/salg
- YouSee er allerede under Fieldmarketing, ingen ændring nødvendig der

### Berørte filer
- `src/pages/dashboards/PowerdagInput.tsx` — tilføj redigerbar point/salg kolonne
- Database — split Tryg/Codan regel

