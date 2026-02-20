

# Synliggør ubrugte TV-links (5+ dage)

## Hvad vi laver
Tilfoej en visuel advarsel i TV Board Admin-tabellen for links der ikke er blevet brugt i 5+ dage (eller aldrig er blevet brugt).

## Aendringer

### Fil: `src/pages/tv-board/TvBoardAdmin.tsx`

1. **Tilfoej en helper-funktion** der beregner om et link er "stale" (ubrugt i 5+ dage):
   - Hvis `last_accessed_at` er `null` OG linket er oprettet for mere end 5 dage siden -> stale
   - Hvis `last_accessed_at` er mere end 5 dage gammel -> stale

2. **Tilfoej visuel indikator i "Sidst brugt"-kolonnen**:
   - Stale links faar en orange/amber advarselsbadge: "Ubrugt i X dage" eller "Aldrig brugt"
   - Rækken faar en subtle baggrundfarve (amber/warning tint) saa den skiller sig ud

3. **Tilfoej et `AlertTriangle`-ikon** fra lucide-react ved stale links for ekstra synlighed

### Konkret logik

```text
function isStale(board): { stale: boolean, daysSince: number | null } {
  const STALE_DAYS = 5;
  const now = new Date();

  if (!board.last_accessed_at) {
    // Aldrig brugt - tjek om oprettet for 5+ dage siden
    const createdDaysAgo = (now - new Date(board.created_at)) / (1000*60*60*24);
    return { stale: createdDaysAgo >= STALE_DAYS, daysSince: null };
  }

  const daysSince = (now - new Date(board.last_accessed_at)) / (1000*60*60*24);
  return { stale: daysSince >= STALE_DAYS, daysSince: Math.floor(daysSince) };
}
```

### Visuel output
- **Stale + aldrig brugt**: Amber badge "Aldrig brugt" med AlertTriangle-ikon
- **Stale + X dage siden**: Amber badge "Ubrugt i X dage" med AlertTriangle-ikon
- **Aktiv (under 5 dage)**: Ingen ekstra indikator, viser dato som nu

### Ingen database-aendringer
Alt data (`last_accessed_at`, `created_at`) findes allerede i tabellen. Kun UI-aendring.

