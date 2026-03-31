

## Tredobl rotationstider på Superliga Live

### Ændringer i `src/pages/tv-board/TvLeagueDashboard.tsx`

**Linje ~109-111** — opdater alle tre timing-konstanter:

| Konstant | Nu | Nyt (×3) |
|---|---|---|
| `DIVISION_DISPLAY_DURATION` | 15s | 45s |
| `LEFT_SCENE_DURATIONS` | [15s, 20s, 20s, 20s] | [45s, 60s, 60s, 60s] |
| `REFRESH_INTERVAL` | 30s | 30s (uændret — data-fetch) |

Data-refresh holdes på 30s da det kun henter data i baggrunden og ikke påvirker visningen.

