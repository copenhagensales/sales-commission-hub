

# Plan: Markeds-booking med Samlet Pris

## Nuværende Situation

Dit system fungerer allerede godt:

1. **Lokationer** - Alle typer (Butik, Storcenter, Markeder, Messer) oprettes under "Lokationer" fanen
2. **Booking** - Markeder bookes via "Book uge" fanen med dato-range picker (allerede implementeret!)
3. **Markeder-oversigt** - "Markeder" fanen viser bookinger filtreret på `location.type = "Markeder"` eller `"Messer"`

**Det eneste der mangler:**
- Et felt til **samlet pris** (i stedet for dagspris) når man booker markeder
- Visning af samlet pris i Markeder-oversigten og Billing

## Hvad vi skal tilføje

### 1. Database: Nyt `total_price` felt

Tilføj en kolonne til `booking` tabellen:

```sql
ALTER TABLE public.booking ADD COLUMN total_price numeric DEFAULT NULL;
```

**Logik:**
- Hvis `total_price` er sat → brug denne direkte
- Hvis `total_price` er NULL → beregn fra dagspris × dage (som nu)

### 2. Book-dialogen: Tilføj "Samlet pris" input

Når du booker et marked via "Book uge" fanen, tilføjes et nyt felt:

```text
+------------------------------------------+
| Book marked/messe                        |
+------------------------------------------+
| Kræmmermarked Fyn                        |
| [Markeder badge]                         |
+------------------------------------------+
| PERIODE                                  |
| Fra: [01-02-2026] Til: [02-02-2026]      |
| (2 dage valgt)                           |
+------------------------------------------+
| PRIS                                     |
| Samlet pris: [15.000] kr                 |  ← NY
| (for hele perioden)                      |
+------------------------------------------+
| Forventet antal medarbejdere: [4]        |
+------------------------------------------+
```

### 3. Markeder-oversigt: Vis samlet pris

I "Markeder" fanen vises samlet pris under hver booking:

```text
+------------------------------------------+
| Kræmmermarked Fyn                        |
| 1-2. feb 2026 | Odense | Uge 5           |
| [Eesy FM] [Fuldt bemandat]               |
| Samlet pris: 15.000 kr                   |  ← NY
+------------------------------------------+
```

### 4. Billing: Opdater prisberegning

Ændr logikken så `total_price` bruges hvis sat:

```typescript
// Nuværende logik:
const total = dailyRate × days;

// Ny logik:
const total = booking.total_price ?? (dailyRate × days);
```

### 5. EditBookingDialog: Mulighed for at redigere samlet pris

Tilføj "Samlet pris" felt i redigerings-dialogen for markeder.

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| Database migration | Tilføj `total_price` kolonne |
| `src/pages/vagt-flow/BookWeekContent.tsx` | Tilføj "Samlet pris" input i booking-dialogen |
| `src/pages/vagt-flow/MarketsContent.tsx` | Vis samlet pris i oversigten |
| `src/pages/vagt-flow/Billing.tsx` | Brug `total_price` hvis sat |
| `src/components/vagt-flow/EditBookingDialog.tsx` | Tilføj redigering af samlet pris |

## Lokationer forbliver som de er

- Markeder oprettes stadig under "Lokationer" (ingen ændring)
- Dagspris-feltet forbliver (bruges som fallback hvis samlet pris ikke sættes)
- "Markeder" fanen er bare en filtreret visning af bookinger

## Tekniske detaljer

**Ny state i BookWeekContent:**
```typescript
const [marketTotalPrice, setMarketTotalPrice] = useState<string>("");
```

**Opdateret insert i mutation:**
```typescript
const { error } = await supabase.from("booking").insert({
  // ... eksisterende felter
  total_price: isMarket && marketTotalPrice 
    ? parseFloat(marketTotalPrice) 
    : null,
});
```

**Prislogik i Billing:**
```typescript
const getBookingTotal = (booking: any) => {
  if (booking.total_price != null) {
    return booking.total_price;
  }
  const dailyRate = booking.daily_rate_override ?? booking.location?.daily_rate ?? 1000;
  const days = booking.booked_days?.length || 1;
  return dailyRate * days;
};
```

