
## Ny "Samtaler" kalender-fane i Booking Flow

Tilføjer en ny fane i BookingFlow-siden der viser en kalendervisning over alle kandidater med booket interview, med mulighed for at markere om man har talt med dem.

### Hvad der bygges

1. **Ny fane "Samtaler"** i BookingFlow-sidens TabsList med et kalender-ikon
2. **Kalendervisning** der viser dage med bookede samtaler som dots/badges
3. **Dagsliste** ved klik på en dato — viser kandidater med navn, telefon, tidspunkt
4. **Handlingsknapper** per kandidat:
   - "Talt med" — opdaterer kandidatens status til `hired` eller `interview_completed` og stopper flowet
   - "Ikke fået fat" — sætter kandidaten tilbage som `contacted` (flowet fortsætter med opfølgning)
5. **Komponent**: Ny `BookingCalendarTab.tsx` under `src/components/recruitment/`

### Teknisk

- Henter kandidater med `status = 'interview_scheduled'` og `interview_date IS NOT NULL`
- Bruger den eksisterende `Calendar` komponent til månedsvisning
- Dage med samtaler markeres visuelt (dot under datoen)
- Ved klik på en dag vises liste over kandidater den dag
- "Talt med" → `candidates.status = 'interview_completed'`, annullerer aktive enrollments
- "Ikke fået fat" → `candidates.status = 'contacted'`, `interview_date = null`, flowet genoptages

### Filer

| Fil | Ændring |
|-----|---------|
| `src/components/recruitment/BookingCalendarTab.tsx` | Ny komponent med kalender + dagsliste + handlingsknapper |
| `src/pages/recruitment/BookingFlow.tsx` | Tilføj ny TabsTrigger + TabsContent der renderer `BookingCalendarTab` |
