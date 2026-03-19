

# 10 UI-forbedringer til liga-boardet (de 9 originale + momentum)

## Oversigt
Implementer de 9 allerede godkendte forbedringer plus #12 "Momentum-indikator" fra de nye forslag.

---

## 1. Animerede Top 3 badges
- **PodiumBadge.tsx**: Tilføj pulserende glow via `shadow-[0_0_8px]` i medal-farven + `animate-[podium-glow_2s_ease-in-out_infinite]`
- **DailyTopBadge.tsx**: Tilføj `animate-pulse` til flamme/lyn-ikoner
- **index.css**: Ny `@keyframes podium-glow` med subtil skalering (1.0 → 1.05) + shadow-pulse

## 2. Sparkline provision-graf (7 dage)
- **Ny hook `src/hooks/useLeagueWeeklyProvision.ts`**: Kald `get_sales_aggregates_v2` med `p_group_by: "both"` for seneste 7 dage, returner `Record<string, number[]>` (employeeId → daglig provision)
- **Ny komponent `src/components/league/ProvisionSparkline.tsx`**: SVG polyline (48×16px), grøn=opadgående, rød=nedadgående trend
- Integreres i PlayerRow/SeasonPlayerRow ved siden af provision

## 3. Flottere divisions-headers med gradient
- Erstat `bg-muted/40` i CardHeader:
  - Salgsligaen: `bg-gradient-to-r from-yellow-500/15 to-amber-500/5` + `Shield`-ikon
  - 1. Division: `bg-gradient-to-r from-slate-400/15 to-slate-300/5`
  - 2. Division+: `bg-gradient-to-r from-orange-500/10 to-orange-400/5`

## 4. Forbedret sticky "Min placering" bar
- **LeagueStickyBar.tsx**: Nye props `todayProvision` og `distanceToNextZone`
- Vis "I dag: X kr" i emerald + afstand til næste zone
- Subtil gradient border-bottom baseret på zone-farve
- **CommissionLeague.tsx**: Beregn og send nye props

## 5. Hover-effekt med tooltip detaljer
- **Ny `src/components/league/PlayerHoverCard.tsx`**: Bruger shadcn `HoverCard`
- Viser: antal salg i dag, ugens total, team, division
- Wrap spillernavn i PlayerRow/SeasonPlayerRow med HoverCardTrigger

## 6. "Live" puls-indikator
- Lille grøn pulserende dot (`animate-ping`, 6×6px) ved spillernavnet hvis `todayProvision > 0`
- Simpel betingelse, ingen ekstra data-fetch

## 7. Animated rank transitions
- `transition-all duration-500` på PlayerRow container
- Ved rank-ændring: kort flash-animation via CSS transition på baggrund

## 8. Progress bar mod næste zone
- **Ny `src/components/league/ZoneProgressBar.tsx`**: 2px farvet bar under provision
- Beregn % mod næste zone-grænse baseret på provision/points
- Farve matcher zone: grøn/orange/rød

## 9. Konfetti-effekt ved ny Top 3
- Installer `canvas-confetti` 
- Trigger i CommissionLeague.tsx når brugerens `overall_rank` ≤ 3 og forrige rank > 3
- Kort burst, kun 1 gang pr. session via `sessionStorage`

## 10. Momentum-indikator (trending op/ned)
- Bruger data fra sparkline-hooken (#2) til at beregne 3-dages trend
- Vis trendpil ved siden af provision: ↗ (grøn), → (grå), ↘ (rød)
- Lille `TrendingUp`/`TrendingDown`/`Minus` ikon fra lucide (10px)
- Integreret i PlayerRow/SeasonPlayerRow sammen med sparkline

---

## Fil-ændringer
| Fil | Handling |
|-----|---------|
| `src/components/league/PodiumBadge.tsx` | Glow animation |
| `src/components/league/DailyTopBadge.tsx` | Pulse animation |
| `src/components/league/ProvisionSparkline.tsx` | **Ny** — SVG sparkline + momentum-pil |
| `src/hooks/useLeagueWeeklyProvision.ts` | **Ny** — 7-dage batch provision hook |
| `src/components/league/PlayerHoverCard.tsx` | **Ny** — HoverCard med detaljer |
| `src/components/league/ZoneProgressBar.tsx` | **Ny** — Progress bar mod zone |
| `src/components/league/QualificationBoard.tsx` | Gradient headers, sparkline, live dot, hover, zone bar, momentum |
| `src/components/league/ActiveSeasonBoard.tsx` | Samme som oven |
| `src/components/league/LeagueStickyBar.tsx` | Today provision, zone distance, gradient |
| `src/pages/CommissionLeague.tsx` | Nye props, confetti trigger |
| `src/index.css` | Nye keyframes: `podium-glow` |
| `package.json` | Tilføj `canvas-confetti` + `@types/canvas-confetti` |

