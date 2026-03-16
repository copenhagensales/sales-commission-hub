

## UX-forbedringer til Salgsligaen

Tre konkrete forbedringer der gør siden mere overskuelig og engagerende:

### 1. Vis kun "Min Division" + "Salgsligaen" som default
**Filer:** `ActiveSeasonBoard.tsx`, `QualificationBoard.tsx`

- Tilføj en `defaultFilter` prop: `"my" | "all"` (default `"my"`)
- Når `"my"`: vis kun top-divisionen og brugerens egen division (find via `currentEmployeeId`)
- Tilføj en "Vis alle divisioner" toggle-knap i bunden
- Reducerer scroll markant for ligaer med mange divisioner

### 2. Sticky mini-statusbar mens man scroller
**Ny fil:** `src/components/league/LeagueStickyBar.tsx`  
**Ændring i:** `CommissionLeague.tsx`

En sticky bar (top, under header) der viser:
- Brugerens rank + division + point i kompakt format
- Kun synlig ved scroll (som `StickyPerformanceBar`-mønsteret der allerede bruges)
- Skjules for fans

```text
┌──────────────────────────────────────────────┐
│  #12  •  2. Division  •  1.450 pt  •  🟢 Sikker  │
└──────────────────────────────────────────────┘
```

### 3. Regler i info-modal i stedet for fast sektion
**Ændring i:** `CommissionLeague.tsx`

- Fjern den store "Sådan fungerer det"-Card fra bunden
- Tilføj et info-ikon (ℹ️) i header-sektionen der åbner en Sheet/Dialog med reglerne
- Sparer vertical plads og holder fokus på standings

### Teknisk oversigt

| Ændring | Fil(er) | Kompleksitet |
|---------|---------|-------------|
| Division-filter | `ActiveSeasonBoard.tsx`, `QualificationBoard.tsx` | Tilføj state + filter-logik |
| Sticky bar | Ny `LeagueStickyBar.tsx` + `CommissionLeague.tsx` | Scroll-listener + kompakt layout |
| Regler → modal | `CommissionLeague.tsx` | Flyt indhold til Sheet |

Alle ændringer er rent frontend — ingen database- eller API-ændringer.

