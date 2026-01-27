
# Forbedre synlighed af team badges på CS Top 20

## Problemet
Team badges (TDC, Eesy, Relatel, United, Fieldmarketing, osv.) har for lav kontrast i det normale dashboard-view:

| Nuværende styling | Problem |
|-------------------|---------|
| `bg-red-500/15` (15% opacity) | Baggrunden er næsten usynlig |
| `text-red-700 dark:text-red-400` | Teksten er svag på mørk baggrund |

Især på mørke temaer fader badges næsten helt ud og bliver svære at læse.

## Løsning
Øg kontrasten markant ved at bruge:
- **Stærkere baggrundsfarver**: Fra 15% → 25-30% opacity
- **Hvid tekst** på farvede baggrunde for bedre læsbarhed
- **Ensartet styling** mellem normal og TV mode

## Ændringer

### Fil: `src/pages/CsTop20Dashboard.tsx`

Opdater `getTeamBadgeStyle()` funktionen (linje 72-100):

**Fra:**
```typescript
if (lower.includes('tdc')) {
  return tvMode 
    ? 'bg-red-500 text-white' 
    : 'bg-red-500/15 text-red-700 dark:text-red-400';  // ← For svag
}
```

**Til:**
```typescript
if (lower.includes('tdc')) {
  return 'bg-red-500 text-white';  // ← Samme kraftige styling altid
}
```

### Komplet ny styling

| Team | Ny Styling | Eksempel |
|------|-----------|----------|
| TDC | `bg-red-500 text-white` | Rød med hvid tekst |
| Eesy | `bg-violet-500 text-white` | Violet med hvid tekst |
| Relatel | `bg-amber-500 text-white` | Amber med hvid tekst |
| United | `bg-indigo-500 text-white` | Indigo med hvid tekst |
| Fieldmarketing | `bg-emerald-500 text-white` | Grøn med hvid tekst |
| Tryg | `bg-teal-500 text-white` | Teal med hvid tekst |
| ASE | `bg-pink-500 text-white` | Pink med hvid tekst |
| Stab/Default | `bg-slate-500 text-white` | Grå med hvid tekst |

## Visuelt resultat

Før: Badges der næsten er usynlige  
Efter: Klare, læsbare badges med god kontrast (som TV mode allerede har)

## Teknisk detalje

Ændringen fjerner den tvMode-betingelse og bruger den kraftigere TV mode-styling som standard. Dette giver:
- Bedre læsbarhed på alle skærme
- Ensartet udseende mellem desktop og TV
- Overholder WCAG kontrastkrav
