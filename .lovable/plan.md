

# Sparkline: Flyt, forstør og 6 forbedringer

## Overblik
Sparkline-grafen flyttes centralt mellem sælgernavn og provision, forstørres, og opgraderes med 6 visuelle forbedringer (3 godkendte + 3 nye).

## Ændringer

### 1. `src/components/league/ProvisionSparkline.tsx` — Komplet omskrivning
- **Størrelse**: SVG fra 48×16 til 80×28, strokeWidth 1.5→2
- **Gradient fill**: `<linearGradient>` + `<polygon>` under linjen, farvet efter momentum (grøn/rød/blå, 20% opacity)
- **Pulserende endpoint**: `<circle>` med CSS `animate-pulse` på sidste datapunkt
- **Draw-animation**: `stroke-dasharray`/`stroke-dashoffset` CSS-animation så linjen tegnes ind over 0.8s
- **Min/max-markører**: Små cirkler (3px) på højeste og laveste punkt med dimmet farve
- **Divisionsgennemsnit-linje**: Ny optional prop `divisionAvg?: number[]` — renderes som tynd stiplet linje i grå
- **Hover tooltip**: Wrap i shadcn `Tooltip` der viser daglige værdier formateret som "Man: 3.200 kr, Tir: 4.100 kr..."
- Ny prop `size?: "sm" | "md"` (md=80×28 default, sm=48×16)

### 2. `src/components/league/QualificationBoard.tsx`
- Fjern sparkline fra provisions-div (linje ~309-311)
- Tilføj nyt `flex-1` element mellem navn-div og provisions-div med sparkline centreret
- Beregn divisionsgennemsnit fra standings-data og send som `divisionAvg` prop
- Fjern `hidden sm:flex` — altid synlig

### 3. `src/components/league/ActiveSeasonBoard.tsx`
- Samme flytning som QualificationBoard (linje ~301-303)
- Tilføj centralt sparkline-element, beregn og send divisionsgennemsnit

### 4. `src/index.css` — Nye keyframes
- `sparkline-draw`: stroke-dashoffset animation (0.8s ease-out)
- `sparkline-pulse-dot`: pulserende cirkel på endpoint

### 5. Klikbar graf med detaljeret view (ny komponent)
- **`src/components/league/SparklineDetailModal.tsx`**: Dialog/popover med recharts `AreaChart` der viser 7 dage med labels, akser, tooltips og divisionens gennemsnit som referencelinje
- Sparkline wraps i klikbar container der åbner modal

## Layout efter ændring
```text
FØR:  [Rank] [Navn+Team]                         [32.850 kr 📈] [0 pt] [Zone]
EFTER: [Rank] [Navn+Team]  [──●──min──max──📈──]  [32.850 kr]   [0 pt] [Zone]
                            ^ gradient fill         ^ klikbar
                            ^ stiplet avg-linje
```

## Filer
| Fil | Handling |
|-----|----------|
| `src/components/league/ProvisionSparkline.tsx` | Omskriv: størrelse, gradient, endpoint, draw-anim, min/max, avg-linje, tooltip |
| `src/components/league/SparklineDetailModal.tsx` | Ny: recharts AreaChart modal med 7-dages detaljer |
| `src/components/league/QualificationBoard.tsx` | Flyt sparkline centralt, beregn divisionsgennemsnit |
| `src/components/league/ActiveSeasonBoard.tsx` | Flyt sparkline centralt, beregn divisionsgennemsnit |
| `src/index.css` | Tilføj sparkline-draw og sparkline-pulse-dot keyframes |

