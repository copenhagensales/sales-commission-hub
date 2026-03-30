

## Fix: Dublet-detektion i Godkendelseskøen for Eesy TM

### Problem
Godkendelseskøen (ApprovalQueueTab) markerer items som "Dublet" baseret på `customer_phone`. For Eesy TM kan én kunde have flere abonnementer (Abo1, Abo2, Abo3) med forskellige telefonnumre, men kun ét `customer_phone`. Når kunden annullerer 1 produkt pr. upload-række, ender flere rækker med samme `customer_phone` — og de markeres fejlagtigt som dubletter.

### Løsning

**Fil: `src/components/cancellations/ApprovalQueueTab.tsx`** (linje 619-632)

Ændre dublet-detekteringslogikken:
- Import `CLIENT_IDS` fra `src/utils/clientIds.ts`
- Tilføj `isEesyTm` check baseret på `clientId`
- **For Eesy TM**: Brug `sale_id` som grupperingsnøgle i stedet for `phone`. To items er kun dubletter hvis de har **samme `sale_id`** (dvs. samme salg uploadet flere gange)
- **For andre klienter**: Bevar nuværende logik (gruppering via `phone`)

### Teknisk ændring

```text
Nuværende logik:
  phoneCounts[item.phone]++ → dublet hvis count > 1

Ny logik:
  if (isEesyTm):
    saleIdCounts[item.sale_id]++ → dublet hvis count > 1
  else:
    phoneCounts[item.phone]++ → dublet hvis count > 1  (uændret)
```

Kun én fil ændres. Ingen database-ændringer.

