

## Fix Dublet-logik for Eesy TM — brug abo-telefonnumre i stedet for customer_phone

### Problem
DuplicatesTab grupperer salg efter `customer_phone`. For Eesy TM har ét salg op til 3 telefonnumre i `raw_payload.data` (Telefon Abo1, Telefon Abo2, Telefon Abo3), men kun ét gemmes i `customer_phone`. Det betyder, at flere salg deler samme `customer_phone` og fejlagtigt vises som dubletter — selvom de reelt dækker forskellige abonnementer/telefonnumre.

### Løsning

**Fil: `src/components/cancellations/DuplicatesTab.tsx`**

1. **Tilføj Eesy TM-specifik gruppering**: Når klienten er Eesy TM, skal hvert salg "udfoldes" til op til 3 rækker — én pr. abo-telefonnummer (Telefon Abo1, Telefon Abo2, Telefon Abo3). Gruppering sker derefter pr. abo-telefonnummer i stedet for `customer_phone`.

2. **Logik**:
   - Detect `isEesyTm` via `CLIENT_IDS["Eesy TM"]`
   - For hvert Eesy TM-salg: udtræk `raw_payload.data["Telefon Abo1"]`, `["Telefon Abo2"]`, `["Telefon Abo3"]`
   - Normaliser hvert telefonnummer og brug det som grupperingsnøgle
   - Et salg kan optræde i flere grupper (hvis det har flere abo-numre der matcher andre salg)
   - Kun grupper med 2+ salg vises (som nu)

3. **Eesy FM bevarer nuværende logik** (gruppering via `customer_phone`)

### Tekniske detaljer

```text
Nuværende flow (alle klienter undtagen TDC):
  sale.customer_phone → groupMap[phone].push(sale)

Nyt flow for Eesy TM:
  for each aboField in ["Telefon Abo1", "Telefon Abo2", "Telefon Abo3"]:
    phone = normalize(sale.raw_payload.data[aboField])
    if phone: groupMap[phone].push(sale)

Eesy FM + andre: uændret (customer_phone)
```

Ingen database-ændringer. Kun ændring i `DuplicatesTab.tsx`.

