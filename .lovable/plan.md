
# Markeds-booking med Dato-range og Samlet Pris

## Overblik

Tilpasser det eksisterende lokations- og booking-system til at håndtere markeder/messer bedre - med dato-range valg og samlet pris i stedet for dagspris.

## Nuværende Situation

- **Lokationer**: Alle typer (Butik, Storcenter, Markeder, Messer) oprettes under "Lokationer"
- **Booking**: Markeder bookes via dato-range picker (allerede implementeret)
- **Pris**: Bruger `daily_rate_override` eller `location.daily_rate` - beregnet per dag
- **Visning**: Markeder vises i "Markeder"-fanen som filtrer på `location.type`

## Løsning

### 1. Database: Tilføj `total_price` felt til booking

Tilføjer et nyt felt så markeder kan bruge samlet pris i stedet for dagspris.

```sql
ALTER TABLE public.booking
ADD COLUMN total_price numeric DEFAULT NULL;

COMMENT ON COLUMN public.booking.total_price IS 
'Samlet pris for hele bookingen (bruges til markeder/messer). 
Hvis sat, ignoreres daily_rate beregning.';
```

### 2. Opdater Lokations-dialogen

Når type "Markeder" eller "Messer" vælges:

**Ny UI-struktur:**
```text
+------------------------------------------+
| Opret ny lokation                        |
+------------------------------------------+
| Navn: [Bellahøj Kræmmermarked 2026    ]  |
| Type: [Markeder ▼]                       |
+------------------------------------------+
| ⚠️ For markeder/messer vælges periode    |
|    ved booking - ikke lokationsoprettelse|
+------------------------------------------+
| LOKATION                                 |
| By: [København         ]                 |
| Adresse: [Bellahøj Friluftsscene      ]  |
| Region: [Hovedstaden ▼]                  |
+------------------------------------------+
| ØKONOMI                                  |
| Standard dagspris: [—] (sættes ved book) |
+------------------------------------------+
|                    [Annuller] [Opret]    |
+------------------------------------------+
```

**Ændringer:**
- Skjul dagspris-feltet for markeder/messer (prisen sættes ved booking)
- Tilføj info-tekst der forklarer at periode vælges ved booking

### 3. Opdater Booking-dialogen i BookWeekContent

For markeder/messer vises dato-range picker (allerede implementeret) + samlet pris:

**Ny UI-struktur:**
```text
+------------------------------------------+
| Book marked/messe                        |
+------------------------------------------+
| Bellahøj Kræmmermarked                   |
| [Markeder badge]                         |
+------------------------------------------+
| PERIODE                                  |
| Fra: [15. aug 2026] Til: [17. aug 2026]  |
| (3 dage - lør-man)                       |
+------------------------------------------+
| PRIS                                     |
| Samlet pris: [15.000] kr                 |
| (for hele perioden)                      |
+------------------------------------------+
| Forventet antal medarbejdere: [4]        |
+------------------------------------------+
| [x] Åben for ansøgninger (altid)         |
|     Synlig fra: [4] uger før             |
|     Deadline: [7] dage før               |
+------------------------------------------+
|                    [Annuller] [Book]     |
+------------------------------------------+
```

**Ændringer:**
- Tilføj input-felt for "Samlet pris" (kun for markeder/messer)
- Gem værdien i `booking.total_price`

### 4. Opdater Billing-logik

Ændr prisberegningen til at respektere `total_price`:

```typescript
// Før
const dailyRate = booking.daily_rate_override ?? booking.location?.daily_rate ?? 1000;
const total = dailyRate * bookedDays.length;

// Efter
const total = booking.total_price 
  ?? (booking.daily_rate_override ?? booking.location?.daily_rate ?? 1000) * bookedDays.length;
```

### 5. Opdater Markeder-oversigt (MarketsContent)

Vis samlet pris i stedet for dagspris for markeder:

```text
+------------------------------------------+
| Bellahøj Kræmmermarked                   |
| 15-17. aug 2026 | København | Uge 33     |
| [Eesy FM] [Fuldt bemandat] [Åben]        |
| Samlet pris: 15.000 kr                   |
+------------------------------------------+
```

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| **Database migration** | Tilføj `total_price` kolonne til `booking` |
| `src/pages/vagt-flow/LocationsContent.tsx` | Skjul dagspris for markeder, tilføj info |
| `src/pages/vagt-flow/BookWeekContent.tsx` | Tilføj "Samlet pris" input for markeder |
| `src/pages/vagt-flow/MarketsContent.tsx` | Vis samlet pris i stedet for dagspris |
| `src/pages/vagt-flow/Billing.tsx` | Opdater prisberegning til at bruge `total_price` |
| `supabase/functions/parse-expense-formula/index.ts` | Opdater formelberegning |
| `src/components/vagt-flow/EditBookingDialog.tsx` | Tilføj redigering af samlet pris |

## Flow efter implementering

1. **Opret lokation**: Bruger opretter "Bellahøj Kræmmermarked" med type "Markeder" (ingen pris)
2. **Book marked**: Bruger vælger dato-range (15-17 aug) og samlet pris (15.000 kr)
3. **Vis i oversigt**: Markedet vises i "Markeder"-fanen med dato og pris
4. **Fakturering**: Billing-systemet bruger `total_price` direkte

## Tekniske detaljer

### State i BookWeekContent
```typescript
const [marketTotalPrice, setMarketTotalPrice] = useState<number | undefined>(undefined);
```

### Mutation-opdatering
```typescript
const { error } = await supabase.from("booking").insert({
  // ... eksisterende felter
  total_price: isMarket ? marketTotalPrice : null,
});
```

### Prislogik i Billing.tsx
```typescript
const getBookingTotal = (booking: any) => {
  // Brug total_price hvis sat (typisk markeder)
  if (booking.total_price != null) {
    return booking.total_price;
  }
  // Ellers beregn fra dagspris
  const dailyRate = booking.daily_rate_override ?? booking.location?.daily_rate ?? 1000;
  const days = booking.booked_days?.length || 1;
  return dailyRate * days;
};
```
