
# Mobil UI/UX Optimering af Home-siden

## Nuværende udfordringer
Baseret på analysen af den aktuelle mobile visning:

1. **Hero-kortet fylder meget** - Den cirkulære progress-ring og tekst tager meget plads på små skærme
2. **Grid-layout på mobil** - Liga og daglig kommission stables korrekt, men graferne fylder meget vertikalt
3. **Chart-højde er fast** - 140px er fint, men kan føles trangt på mobil med mange bars
4. **Team & Fællesskab-sektionen** - Begivenheder har mange knapper, der kan være svære at trykke på mobil
5. **Manglende mobile-first polish** - Spacing, fontstørrelser og touch-targets kan optimeres

## Foreslåede forbedringer

### 1. Kompakt Hero-kort på mobil
- Reducer progress-ring størrelse fra 140px til **100px på mobil**
- Brug **horisontalt layout** på mobil med ring til venstre og stats til højre
- Mindre padding (p-4 i stedet for p-5) på mobil
- Kortere motivationsbesked på mobil

### 2. Forbedret graf-visning
- Større touch-targets på bars i grafen
- Bedre læsbare dagsnavne (forkortet på mobil)
- Motivationsbesked med større emoji for bedre synlighed

### 3. Touch-optimerede begivenheder
- Større klikbare områder på events (min-height: 48px)
- Mere kompakte action-knapper med swipe-gesture support (fremtidig)
- Tydeligere separator mellem events

### 4. Liga-visning polish
- Kompaktere ranking med bedre kontrast
- Større touch-target på "Se fuld liga" knap

### 5. Generelle mobile forbedringer
- Reducer vertical spacing (gap-4 → gap-3 på mobil)
- Ensartede border-radius
- Bedre kontrast på muted tekst
- Smooth scroll-oplevelse

## Tekniske ændringer

### `src/components/home/HeroPerformanceCard.tsx`
```text
- Dynamisk ring-størrelse: 100px på mobil, 140px på desktop
- Horisontalt layout på mobil med flexbox
- Mindre padding og kompaktere typography
- Responsiv CTA-knap størrelse
```

### `src/components/home/DailyCommissionChart.tsx`
```text
- Tilpas chart margins for mobil
- Større motivations-emoji
- Kompaktere header
```

### `src/components/home/CompactLeagueView.tsx`
```text
- Bedre spacing i ranking-liste
- Større touch-targets
- Mere synlig "dig" markering
```

### `src/pages/Home.tsx`
```text
- Responsiv grid-gap (gap-3 på mobil, gap-4 på tablet+)
- Bedre padding i Team & Fællesskab sektion
- Touch-optimerede event-kort
- Mere kompakte celebration badges
```

### `src/components/home/StickyPerformanceBar.tsx`
```text
- Subtil gradient baggrund for bedre synlighed
- Animeret indgang
```

## Resultat
En mere "native-app-agtig" oplevelse på mobil med:
- Hurtigere visuel scanning
- Bedre touch-interaktion
- Mere poleret og moderne udseende
- Bedre udnyttelse af skærmplads

