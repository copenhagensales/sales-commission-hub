

## Ny "Booking-side" fane i Recruitment Dashboard

### Overblik

Tilføj en tredje fane **"Booking-side"** i `BookingFlow.tsx` med to sektioner:

1. **Preview / åbn booking-side** — vælg en kandidat fra en dropdown og åbn deres offentlige booking-side i nyt vindue
2. **Indstillinger for booking-tider** — konfigurér hvornår kandidater kan booke (arbejdstider, slot-varighed, antal dage frem, blokerede datoer)

### Ændringer

**1. Database: `booking_settings` tabel**

Ny tabel til at gemme booking-konfiguration:
- `id`, `work_start_hour` (default 9), `work_end_hour` (default 17), `slot_duration_minutes` (default 15), `lookahead_days` (default 14), `blocked_dates` (text[] for specifikke datoer man vil blokere), `updated_at`
- Én række (singleton config). RLS: authenticated kan læse, teamleder+ kan opdatere.

**2. `src/components/recruitment/BookingSettingsTab.tsx` (ny)**

Ny komponent med to sektioner:

**Sektion A — "Åbn booking-side":**
- Dropdown med alle kandidater (fra `candidates` tabel)
- Søgefelt til at finde kandidat hurtigt
- "Åbn booking-side" knap der åbner `/book/{candidateId}` i nyt vindue
- Kopiér-link knap

**Sektion B — "Indstillinger for ledige tider":**
- Arbejdstider: start-time og slut-time (dropdowns, fx 08:00–18:00)
- Slot-varighed: 15 min / 30 min / 45 min / 60 min
- Antal dage frem: slider/input (1–30)
- Blokerede datoer: dato-picker til at tilføje/fjerne specifikke datoer
- Gem-knap der upsert'er til `booking_settings`

**3. `BookingFlow.tsx`**
- Tilføj tredje TabsTrigger: "Booking-side" med Calendar-ikon
- TabsContent renderer `<BookingSettingsTab />`

**4. `get-public-availability` edge function**
- Hent `booking_settings` fra databasen i stedet for hardcodede værdier
- Brug `work_start_hour`, `work_end_hour`, `slot_duration_minutes`, `lookahead_days`
- Filtrér `blocked_dates` fra tilgængelige dage

### Filer

| Fil | Ændring |
|-----|---------|
| Migration | Ny `booking_settings` tabel med defaults |
| `src/components/recruitment/BookingSettingsTab.tsx` | **Ny** — preview + indstillinger |
| `src/pages/recruitment/BookingFlow.tsx` | Tilføj "Booking-side" fane |
| `supabase/functions/get-public-availability/index.ts` | Læs settings fra DB |

