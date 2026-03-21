

# Fix: Telefonnumre mangler fra Adversus-salg

## Årsag
Adversus API'ens `/results` endpoint returnerer salgsobjekter **uden lead-kontaktdata** — der er intet `lead.phone` felt. Adapteren sætter `customerPhone: s.lead?.phone || ""` som altid er tom.

Enrichment-healeren henter efterfølgende lead-data fra `/leads/{leadId}` og får telefonnummeret, men **gemmer det ikke** — den opdaterer kun `raw_payload.leadResultFields` (custom fields) og sætter aldrig `customer_phone`.

**Resultat**: 1.012 ud af 1.522 Tryg-salg i februar har `customer_phone = NULL`.

## Løsning
Ret enrichment-healeren til også at ekstrahere og gemme telefonnummeret fra lead-data.

## Teknisk ændring

### `supabase/functions/enrichment-healer/index.ts` (~linje 114-146)

I `healAdversus`-funktionen, efter `const leadData = await response.json()`:

1. Ekstraher telefonnummer: `const phone = leadData.phone || leadData.contactPhone || null`
2. Tilføj `customer_phone: phone` til `supabase.from("sales").update({...})` kaldet (linje 140-146), så telefonnummeret gemmes direkte i kolonnen

```typescript
// Eksisterende: gemmer kun leadResultFields
await supabase.from("sales").update({
  raw_payload: updatedPayload,
  enrichment_status: "healed",
  ...
}).eq("id", sale.id);

// Nyt: gemmer også telefonnummer
const phone = leadData.phone || leadData.contactPhone || null;
await supabase.from("sales").update({
  raw_payload: updatedPayload,
  enrichment_status: "healed",
  ...(phone && !sale.customer_phone ? { customer_phone: phone } : {}),
  ...
}).eq("id", sale.id);
```

### Backfill af eksisterende data
Kør en one-time opdatering: For alle salg med `enrichment_status = 'healed'` og `customer_phone IS NULL`, re-kør enrichment-healeren. Alternativt kan vi lave en simpel migration der sætter `enrichment_status = 'pending'` for disse salg, så den eksisterende cron-job re-healer dem.

## Filer

| Fil | Ændring |
|-----|---------|
| `supabase/functions/enrichment-healer/index.ts` | Tilføj `customer_phone` til update-kaldet i `healAdversus` |

## Resultat
- Nye salg fra Adversus får automatisk telefonnummer ved enrichment
- Eksisterende salg kan re-heales for at udfylde telefonnumre
- Salgsvalidering vil kunne matche langt flere salg (1.500+ i stedet for 510)

