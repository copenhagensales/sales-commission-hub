

## Powerdag Board — Visuelt Upgrade

Boardet er funktionelt men ser ud som en simpel liste. Her er forslaget til at gøre det til et ægte konkurrence-board:

### Visuelle forbedringer

**1. Podium-sektion for Top 3**
- Dedikeret podium-layout øverst med #1 i midten (størst), #2 til venstre, #3 til højre
- Guld/sølv/bronze farvekoder med glow-effekter
- Stort pointtal med animeret counter-effekt
- Trophy/medal ikoner med shimmer-animation

**2. Progress-bar mellem teams**
- Horisontal bar under hvert team der viser point relativt til #1
- Giver visuelt overblik over hvor tæt konkurrencen er

**3. Animationer og effekter**
- Entries fader ind med staggered animation
- Point-tal har tabular-nums med stor, fed skrift og subtle glow for top 3
- Pulse-animation på #1 kortet
- Shimmer-effekt på podium-kort

**4. Bedre spacing og typografi**
- Større kontrast mellem top 3 og resten
- Team-kort med hover-effekt
- Rank-nummer i cirkel med gradient baggrund for top 3

**5. Live-indikator**
- Lille grøn pulserende dot i headeren der viser "Live"
- Sidst opdateret timestamp

### Teknisk

**Fil: `src/pages/dashboards/PowerdagBoard.tsx`** — komplet redesign af layoutet:
- Ny `PodiumCard` komponent til top 3 med guld/sølv/bronze styling
- Staggered fade-in via inline `animation-delay`
- Relativ progress-bar (`team.total_points / maxPoints * 100%`)
- CSS animations via eksisterende Tailwind keyframes + nye inline styles
- TV-mode: Podium endnu større, auto-scroll resten

Ingen nye dependencies eller database-ændringer nødvendige.

