

## Flere tidsvinduerne pr. dag + valgbare ugedage

### Hvad ændrer sig

I dag har `booking_settings` ét enkelt tidsvindue (`work_start_hour`/`work_end_hour`) og hardcoded "kun hverdage". Det udvides med:

1. **Flere tidsvinduerne pr. dag** — fx 10:00–12:30 og 14:00–16:30
2. **Valgbare ugedage** — fx kun man–fre, eller man+ons+fre
3. De gamle `work_start_hour`/`work_end_hour` beholdes som fallback

### Database

Tilføj to nye kolonner til `booking_settings`:

- `time_windows jsonb DEFAULT '[{"start":"09:00","end":"17:00"}]'` — array af `{start, end}` objekter
- `available_weekdays integer[] DEFAULT '{1,2,3,4,5}'` — 1=mandag ... 7=søndag, default = hverdage

### UI: BookingSettingsTab.tsx

Erstat de to "Starttidspunkt"/"Sluttidspunkt" dropdowns med:

**Tidsvinduerne-sektion:**
- Viser hvert vindue som en række: `[HH:MM] – [HH:MM]` med slet-knap
- "Tilføj tidsvindue" knap
- Tidsvalg via Select med 15-min intervaller (06:00–20:00)

**Ugedage-sektion:**
- 7 toggle-knapper (Ma, Ti, On, To, Fr, Lø, Sø) — klik for at aktivere/deaktivere
- Default: Ma–Fr aktive

### Edge function: get-public-availability

- Læs `time_windows` og `available_weekdays` fra settings
- Fallback: hvis `time_windows` er null, brug gamle `work_start_hour`/`work_end_hour`
- Loop over hvert tidsvindue pr. dag og generer slots inden for det
- Filtrér dage baseret på `available_weekdays` i stedet for hardcoded weekend-check

### Filer

| Fil | Ændring |
|-----|---------|
| Migration | Tilføj `time_windows` + `available_weekdays` kolonner |
| `src/components/recruitment/BookingSettingsTab.tsx` | Nyt UI for tidsvinduerne + ugedage |
| `supabase/functions/get-public-availability/index.ts` | Brug `time_windows` + `available_weekdays` |

