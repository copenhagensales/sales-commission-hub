

# Tilføj "Dagens Top 3"-symboler til liga-boardet

## Oversigt
Vis et medal-/flamme-ikon ved de 3 spillere med højest provision i dag, uanset hvilken division de er i. Symbolerne vises ved siden af "I dag"-teksten.

## Ændringer

### 1. `src/components/league/QualificationBoard.tsx`
- Beregn `todayTop3` fra `todayProvisionMap`: sortér alle employee IDs efter dagens provision, tag top 3 (kun dem med > 0)
- Send `todayDailyRank` (1, 2, eller 3) ned til `PlayerRow`
- I `PlayerRow`: vis et ikon ved siden af "I dag"-linjen:
  - 🥇 (guld cirkel) for #1
  - 🥈 (sølv cirkel) for #2  
  - 🥉 (bronze cirkel) for #3
- Brug små farvede cirkler med tal eller Flame/Zap-ikon med farve

### 2. `src/components/league/ActiveSeasonBoard.tsx`
- Samme logik: beregn `todayTop3` fra `todayProvisionMap`
- Send `todayDailyRank` til `SeasonPlayerRow`
- Vis samme ikon/badge

### 3. Ny komponent: `src/components/league/DailyTopBadge.tsx`
- Simpel komponent der tager `rank: 1 | 2 | 3`
- Viser et lille ikon:
  - Rank 1: 🔥 flamme-ikon i guld/orange
  - Rank 2: sølvfarvet lyn-ikon
  - Rank 3: bronzefarvet lyn-ikon
- Alternativt: brug små runde badges med "🥇", "🥈", "🥉" eller tal i farvede cirkler

### Visuel placering
Badgen vises til venstre for "I dag: X kr"-teksten, f.eks.:
```
  25.050 kr
  🔥 I dag: 4.750 kr
```

