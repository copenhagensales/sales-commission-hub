

## Fix: Tilføj divisionsfilter til TV-mode højre zone

### Problem
I `src/pages/tv-board/TvLeagueDashboard.tsx` linje 1111 sendes `data.divisions` ufiltreret til `SceneDivisions` i TV-mode. Filteret `d.division <= 4` er kun sat på mobil-visningen (linje 888), men ikke på den faktiske TV-visning.

### Ændring

**Fil:** `src/pages/tv-board/TvLeagueDashboard.tsx`

**Linje 1111** — tilføj filter:
```tsx
// Fra:
<SceneDivisions divisions={data.divisions} />

// Til:
<SceneDivisions divisions={data.divisions.filter(d => d.division <= 4)} />
```

En enkelt linje-ændring. Alle andre steder er allerede korrekt filtreret.

