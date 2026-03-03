

## Plan: Korrekt håndtering af bookinger der krydser månedsskift

### Forretningsregler (bekræftet)

**To separate logikker:**

1. **Fakturering (billing):** Kun dage *inden for* den valgte periode faktureres. En booking 27/12–2/1 i december-rapporten → kun 27-31/12 faktureres. Resterende 1-2/1 faktureres i januar.

2. **Rabatberegning (placements):** En hel booket uge tæller som placement i den måned, hvor ugen **starter**. Uge 1 (29/12–2/1) → tæller i december, fordi ugen starter i december. Dette sikrer at rabattrappen ikke mister uger der krydser månedsskift.

### Nuværende problemer

| Problem | Konsekvens |
|---------|------------|
| Query filtrerer `start_date` inden for perioden | Bookinger der starter før perioden men overlapper, mangler helt |
| Ingen klipning af dage til perioden | Dage uden for perioden tælles med i fakturering |
| Placements tælles ud fra alle dage i bookingen | Uger der krydser måneder kan tælles dobbelt eller slet ikke |

### Ændringer i `src/components/billing/SupplierReportTab.tsx`

**1. Query-filter → overlap-logik (linje ~115-117 og ~135-137)**

Fra:
```
.gte("start_date", periodStart).lte("start_date", periodEnd)
```
Til:
```
.lte("start_date", periodEnd).gte("end_date", periodStart)
```

Fanger alle bookinger der overlapper med perioden.

**2. `countBookedDays` → klip til perioden**

Tilføj `periodStart`/`periodEnd` parametre. Loop kun over dage der falder inden for perioden:
```
effectiveStart = max(booking.start_date, periodStart)
effectiveEnd = min(booking.end_date, periodEnd)
```

**3. `calcBookingTotal` → brug klippede dage**

Beregn pris ud fra de klippede dage (daily_rate × klippede dage). Hvis `total_price` er sat, proratér den baseret på forholdet klippede/totale dage.

**4. `getBookedWeekdays` → klip visning til perioden**

Vis kun ugenumre/dage der falder inden for perioden, så tabellen matcher faktureringen.

**5. NY: `countDiscountPlacements` → uge-start-baseret**

Separat funktion til rabatberegning der:
- Samler alle bookede uger (ISO-ugenumre) per lokation
- Tilskriver hver uge til den måned, hvor ugens **mandag** falder
- Kun tæller uger der tilhører den valgte periodes måned
- Bevarer eksisterende `minDaysPerLocation`-logik (consecutive days → placement)

**6. YTD-beregning → samme overlap + klipning**

YTD-queryen bruger også overlap-filter. Hver booking klippes til den relevante del inden for YTD-perioden.

### Berørte filer

| Fil | Ændring |
|-----|---------|
| `SupplierReportTab.tsx` | Overlap-query, klipning af fakturering til periode, uge-start-baseret rabattælling |

### Eksempel: Frederiksberg Centeret, uge 1

Booking: 29/12 – 2/1, booked_days: [Man, Tir, Ons, Tor, Fre]

| | December-rapport | Januar-rapport |
|---|---|---|
| **Fakturering** | 3 dage (29, 30, 31 dec) | 2 dage (1, 2 jan) |
| **Rabat-placement** | ✅ Tæller (uge 1 starter i dec) | ❌ Tæller ikke (ugen startede i dec) |

