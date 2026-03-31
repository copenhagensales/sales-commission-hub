

## Problem

På jeres 65" TCL-skærm (sandsynligvis 4K / 3840×2160) ser liga-dashboardet for småt ud. Layoutet er designet til 1920×1080, men skalerer ikke ordentligt op til højere opløsninger — tekst, badges og spacing forbliver for småt til at læse på afstand.

## Løsning

Brug den allerede eksisterende `useTvScreenAdapter`-hook til at skalere hele liga-dashboardet op i TV-mode. Hooket beregner en `scaleFactor` baseret på skærmens opløsning vs. en 1920×1080-reference og anvender en CSS `transform: scale()`.

### Ændring i `TvLeagueDashboard.tsx`

Når `tvMode === true`:
1. Importér `useTvScreenAdapter`, `getTvScaleStyles` og `getTvCenteringStyles`
2. Wrap hele indholdet i en centering-container + scale-wrapper
3. Layoutet renderes i faste 1920×1080 dimensioner og skaleres op til den faktiske skærmstørrelse (f.eks. ×2 på 4K)

Dette vil gøre at dashboardet ser identisk ud på alle skærmstørrelser — bare større/mindre proportionelt.

### Teknisk detalje

```text
┌─── Viewport (3840×2160) ───────────────┐
│  ┌─ Centering wrapper (padding) ─────┐ │
│  │  ┌─ Scale wrapper (scale: 2.0) ─┐ │ │
│  │  │  1920×1080 layout             │ │ │
│  │  │  (same as Full HD)            │ │ │
│  │  └───────────────────────────────┘ │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `src/pages/tv-board/TvLeagueDashboard.tsx` | Wrap TV-mode output i scale-adapter |

