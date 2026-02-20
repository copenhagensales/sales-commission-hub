

# Tilføj brugsdata til TV Links-dialogen

## Hvad ændres
TV Links-dialogen (den der åbnes fra dashboard-indstillinger) udvides med brugsstatistik for hver adgangskode, så du hurtigt kan se hvilke der bruges aktivt.

## Synlige ændringer
For hver adgangskode i listen vises nu:
- Antal visninger (fx "41 visninger")
- Sidst brugt tidspunkt (fx "i dag kl. 12:09" eller "22. jan")
- Orange advarsel hvis koden ikke er brugt i 5+ dage eller aldrig er brugt

## Tekniske detaljer

### Fil: `src/components/dashboard/TvBoardQuickGenerator.tsx`

1. Tilføj imports: `Eye`, `AlertTriangle` fra lucide-react, `format` og `da` fra date-fns
2. Tilføj `getStaleInfo`-hjælpefunktion (samme logik som i TvBoardAdmin)
3. Udvid hvert kode-element i listen med en ekstra linje der viser:
   - Et øje-ikon med `access_count`
   - Sidst brugt dato formateret med dansk locale
   - Orange badge hvis stale (5+ dage uden brug)

Queryen henter allerede `*` fra tabellen, så `access_count` og `last_accessed_at` er tilgængelige uden ændringer i data-laget.

