

# Redesign league-rows: "Tjent i dag" + Top 3-ikoner + visuelt løft

## Ændringer

### 1. `src/components/league/DailyTopBadge.tsx` — Større, mere levende top 3-badge
- Gør badgen større (h-4 w-4) med en glow-effekt og `animate-pulse`
- Top 1: Flamme-ikon i guld med glow
- Top 2: Lyn-ikon i sølv
- Top 3: Lyn-ikon i bronze
- Tilføj et nyt `DailyTopBadgeLarge` variant der viser ikon + "🔥 #1" tekst for ekstra synlighed

### 2. `src/components/league/QualificationBoard.tsx` — PlayerRow redesign
**Erstat deals med "tjent i dag":**
- Under provision-beløbet: vis altid "I dag: X kr" (emerald når > 0, muted når 0)
- Fjern "0 pt" placeholder (linje 363, 384-386)

**Top 3 badge mere prominent:**
- For top 3 daglige: vis DailyTopBadge ved siden af navnet (ikke gemt under provision)
- Tilføj en subtil glow-baggrund på hele rækken for top 3 daglige

**Visuelt løft:**
- Bedre spacing og mere luft i rækkerne
- Provision-beløbet i lidt større font med bedre kontrast
- "I dag"-beløbet i emerald-grøn med lille pulserende dot for aktive
- Fjern den statiske "0 pt" kolonne som fylder plads uden værdi
- Rank-change pile mere kompakte og inline med navnet

### 3. `src/components/league/PremierLeagueBoard.tsx` — Tilsvarende ændringer
- Tilføj `todayProvisionMap` og `todayDailyRank` props (som QualificationBoard allerede har)
- Vis "I dag: X kr" under provision i stedet for deals
- Top 3 daily badge ved aktive sælgere

## Ingen backend-ændringer
Al data (todayProvision, todayDailyRank) er allerede tilgængelig via props.

| Fil | Ændring |
|-----|---------|
| `src/components/league/DailyTopBadge.tsx` | Større badge med glow-effekt for top 3 |
| `src/components/league/QualificationBoard.tsx` | Erstat deals/pt med "I dag: X kr", visuelt løft, prominent top 3 |
| `src/components/league/PremierLeagueBoard.tsx` | Samme "I dag" + top 3 badge tilføjelser |

