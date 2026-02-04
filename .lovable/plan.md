
# Plan: Daglig DB-visning per Klient med Centre/Boder Udgifter

## Problemet

I dag beregner `ClientDBTab` centre/boder-udgifter som en samlet sum for hele perioden. Dette fungerer fint til månedsoversigt, men gør det umuligt at se daglig indtjening, fordi udgifterne ikke er fordelt på specifikke datoer.

**Eksempel på problemet:**

| Klient | Periode | Centre/Boder |
|--------|---------|--------------|
| Eesy FM | Feb 1-28 | 75.000 kr |

Du vil gerne kunne se:

| Dato | Omsætning | Sælgerløn | Centre/Boder | DB |
|------|-----------|-----------|--------------|-----|
| 3. feb | 12.000 | -3.000 | -6.500 | 2.500 |
| 4. feb | 15.000 | -3.750 | -6.500 | 4.750 |

---

## Løsning

Opret en ny `ClientDBDailyBreakdown` komponent der beregner lokationsomkostninger pr. dag baseret på booking-data.

**Hvordan lokationsomkostninger beregnes pr. dag:**

1. For hver booking, tjek om datoen falder inden for `start_date` og `end_date`
2. Tjek om datoen's ugedag (mandag=0, tirsdag=1, osv.) matcher et indeks i `booked_days` array
3. Hvis begge betingelser opfyldes → tilføj `daily_rate` til den dato

```text
Eksempel: Booking for Eesy FM
┌──────────────────────────────────────────────────────────────────────────┐
│ start_date: 2026-02-02                                                   │
│ end_date: 2026-02-06                                                     │
│ booked_days: [0, 1, 2, 3, 4]  ← Mandag til fredag                        │
│ daily_rate: 1.500 kr                                                     │
├──────────────────────────────────────────────────────────────────────────┤
│ Resultat:                                                                │
│ - 2. feb (mandag) → 1.500 kr                                             │
│ - 3. feb (tirsdag) → 1.500 kr                                            │
│ - 4. feb (onsdag) → 1.500 kr                                             │
│ - 5. feb (torsdag) → 1.500 kr                                            │
│ - 6. feb (fredag) → 1.500 kr                                             │
│ - Weekend → 0 kr (ikke i booked_days)                                    │
└──────────────────────────────────────────────────────────────────────────┘
```

---

## Tekniske ændringer

### 1. Opret ny komponent: `ClientDBDailyBreakdown.tsx`

**Props:**
- `clientId` - ID på den klient der vises
- `clientName` - Klientnavn til header
- `periodStart` / `periodEnd` - Valgt periode
- `onClose` - Callback til at lukke panelet

**Funktionalitet:**
1. Hent salgsdata grupperet pr. dato via `useSalesAggregatesExtended`
2. Hent bookings for klienten der overlapper med perioden
3. For hver dato med salg:
   - Beregn omsætning og provision fra salgsdata
   - Beregn lokationsomkostninger ved at iterere alle bookings og tjekke om datoen matcher

**Hjælpefunktion til ugedagskonvertering:**
```typescript
// JavaScript getDay: 0=søndag, 1=mandag, ..., 6=lørdag
// booked_days format: 0=mandag, 1=tirsdag, ..., 6=søndag
function getBookedDayIndex(date: Date): number {
  const jsDay = date.getDay(); // 0=søndag
  return jsDay === 0 ? 6 : jsDay - 1; // Konverter til 0=mandag
}
```

### 2. Opdater `ClientDBTab.tsx`

- Tilføj state for `selectedClientForDaily` (klient der vises i daglig view)
- Tilføj en kalender-knap i hver klient-række
- Render `ClientDBDailyBreakdown` når en klient er valgt

---

## UI-ændring

I `ClientDBTab` tabellen tilføjes en ny kolonne med kalender-ikon:

| Klient | Team | Salg | Omsætning | ... | Final DB | 📅 |
|--------|------|------|-----------|-----|----------|----|

Klik på 📅 åbner daglig breakdown under tabellen (ligesom `DBDailyBreakdown` gør for teams).

---

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `src/components/salary/ClientDBDailyBreakdown.tsx` | **Ny fil** - Daglig DB-visning for én klient med centre/boder pr. dag |
| `src/components/salary/ClientDBTab.tsx` | Tilføj state og knap for daglig view, render `ClientDBDailyBreakdown` |

---

## Forventet resultat

Efter implementation kan du:
1. Gå til "DB per Klient" fanen
2. Klikke på kalender-ikonet ud for fx "Eesy FM"
3. Se en daglig tabel med omsætning, sælgerløn, centre/boder udgifter og DB pr. dag
4. Lokationsomkostninger er nu korrekt fordelt på de dage hvor bookinger faktisk var aktive
