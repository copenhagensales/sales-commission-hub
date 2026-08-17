# Holdkonkurrence: start fra kvalifikationsrundens første dag

## Mål
Holdkonkurrencen i Superligaen skal måle provision fra **kvalifikationsrundens første dag** i stedet for sæsonens runde 1. Slutdatoen er uændret (sæsonens `end_date`, eller i dag hvis sæsonen stadig kører).

For nuværende sæson (sæson 4) betyder det:
- Start i dag: 17. august 2026 (runde 1)
- Ny start: 10. august 2026 (kvalifikationens første dag, `qualification_source_start` = 9. aug 22:00 UTC = 10. aug 00:00 København)
- Slut: 28. september 2026 (uændret)

Sidste uges salg (kvalifikationsugen) tæller derfor med i holdtotalerne.

## Ændringer
Kun holdkonkurrencen berøres. Den individuelle superliga, divisioner, runder og point rører vi ikke.

### `src/hooks/useLeagueTeamCompetition.ts`
- Beregn periodestart ud fra `season.qualification_source_start` (fallback: `qualification_start_at`, derefter `start_date` hvis kvalifikationsfelterne mangler).
- Konvertér tidsstemplet til København-dato, så perioden starter kl. 00:00 dansk tid på kvalifikationens første dag.
- Brug denne startdato overalt hvor `startDate` bruges i dag: `hasStarted`, `periodStart`, samt `hasBefore`-tjekket for dagsdelta/pladsændring.
- Slutlogikken (`end_date` vs. i dag) forbliver som den er.
- Tilføj startdatoen til React Query-nøglen, så cachen ikke viser den gamle periode.

### UI
Hvis holdkonkurrencens visning (`TeamCompetitionView.tsx`) viser periodetekst, opdateres den automatisk via `periodStart` fra hooken — ingen ændring nødvendig ud over kontrol af at datoen vises korrekt.

## Verificering
Efter ændringen sammenlignes en holdtotal med provision for perioden 10. aug – i dag via aggregerings-RPC'en, så tallene stemmer.
