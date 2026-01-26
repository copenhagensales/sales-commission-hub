
# Plan: Tilføj unikke farver til team badges i CS Top 20

## Oversigt
Gør det lettere at skelne mellem teams ved at give hvert team sin egen farve på badge'et. Designet bevarer det nuværende rene UI/UX, men tilføjer subtil farve-kodning.

## Design-tilgang (UX/UI fokus)

### Farvepalette (genbruger eksisterende)
Anvender den allerede definerede palette fra systemet for konsistens:

| Team | Farve | Hex |
|------|-------|-----|
| Eesy TM / Eesy | Violet | `#8b5cf6` |
| Fieldmarketing | Grøn | `#10b981` |
| Relatel | Amber | `#f59e0b` |
| TDC Erhverv / TDC | Rød | `#ef4444` |
| United | Indigo | `#6366f1` |
| Tryg | Teal | `#14b8a6` |
| ASE | Pink | `#ec4899` |
| Ukendt/andet | Grå | `#6b7280` |

### Styling af badges
- **Normal mode**: Lys baggrund med teamfarve som accent (10-15% opacity) + farvet tekst
- **TV mode**: Mættet baggrund med hvid tekst for bedre læsbarhed på afstand
- Beholder den kompakte størrelse (`text-[10px]`, `px-1.5 py-0.5`)
- Afrundede hjørner (rounded) bevares

### Eksempel på visuel effekt
```
Normal mode:   [TDC]     ← rødlig baggrund, rød tekst
               [Eesy]    ← violet baggrund, violet tekst
               [Relatel] ← amber baggrund, amber tekst

TV mode:       [TDC]     ← solid rød baggrund, hvid tekst
               [Eesy]    ← solid violet baggrund, hvid tekst
```

## Tekniske ændringer

### 1. Tilføj team farve-mapping funktion
Opretter en `getTeamColor` funktion der returnerer passende Tailwind classes baseret på teamnavn:

```typescript
const getTeamBadgeStyle = (teamName: string | null | undefined, tvMode: boolean) => {
  if (!teamName) return '';
  const lower = teamName.toLowerCase();
  
  // Map team til farve-klasser
  if (lower.includes('tdc')) {
    return tvMode 
      ? 'bg-red-500 text-white' 
      : 'bg-red-500/15 text-red-600';
  }
  if (lower.includes('eesy')) {
    return tvMode 
      ? 'bg-violet-500 text-white' 
      : 'bg-violet-500/15 text-violet-600';
  }
  // ... osv for andre teams
  
  // Default
  return tvMode 
    ? 'bg-slate-600/60 text-slate-400' 
    : 'bg-muted/80 text-muted-foreground';
};
```

### 2. Opdater badge-rendering
Erstatter den statiske grå styling med dynamisk farve:

```typescript
// Før:
<span className={`... ${tvMode ? 'bg-slate-600/60 text-slate-400' : 'bg-muted/80 text-muted-foreground'}`}>

// Efter:
<span className={`flex-shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${getTeamBadgeStyle(seller.teamName, tvMode)}`}>
```

## Fil der ændres
- `src/pages/CsTop20Dashboard.tsx`

## Resultat
- Hurtigere visuel scanning af leaderboards
- Teams springer i øjnene uden at dominere layoutet
- Konsistent farve-kodning på tværs af perioder (dag, uge, løn)
- Fungerer både i normal og TV-mode
