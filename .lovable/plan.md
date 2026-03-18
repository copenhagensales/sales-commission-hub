

## Hero Header Redesign — 3-kolonne layout

Headeren deles i 3 klare zoner i en horisontal grid (`grid-cols-[1fr_auto_1fr]`) på desktop, med en stacked mobil-fallback.

### Layout

```text
┌──────────────────┬─────────────────────┬──────────────────┐
│  VENSTRE         │      CENTER         │       HØJRE      │
│                  │                     │                  │
│  Kvalifikation   │   🏆 SÆSON 1 [Fan] │    04 : 08 : 58  │
│  Runde 1         │                     │    dage  timer   │
│  69 spillere     │   Formand: Oscar B. │    ══════ 45%    │
│                  │   (i) Regler        │                  │
└──────────────────┴─────────────────────┴──────────────────┘
```

### Venstre kolonne (left-aligned)
- **Runde-status** som en lille badge/pill: `Kvalifikationsrunde` med en pulserende grøn dot
- **Antal spillere**: `69 spillere tilmeldt` i `text-xs text-muted-foreground`
- Eventuelt Fan-badge her i stedet for center

### Center kolonne (centreret)
- Trophy-ikon (`h-10 w-10`) med glow-animation
- **"SÆSON 1"** i `text-3xl md:text-4xl font-extrabold uppercase tracking-wider` med guld-gradient (`from-amber-200 via-yellow-400 to-amber-500 bg-clip-text text-transparent`)
- Fan-badge inline efter titlen
- Under titlen: "Formand: Oscar Belcher" i `text-xs text-muted-foreground`
- Under det: `LeagueRulesSheet compact`

### Højre kolonne (right-aligned)
- `QualificationCountdown` komponent, højrestillet
- Ingen ændringer i countdown-komponentens interne design

### Baggrund
- Forstærk gradient: `from-slate-900 via-indigo-950 to-purple-950`
- Tilføj en subtil top-border highlight: `border-t-2 border-indigo-500/30`
- Padding øges til `p-6 md:p-8`

### Mobil (under md)
- Fallback til `flex-col items-center text-center gap-4` — center-kolonnen først, derefter venstre info, derefter countdown

### Filer der ændres
1. **`CommissionLeague.tsx`** (linje 286-314) — Erstat flex-layout med CSS grid, omstrukturer indhold i 3 zoner
2. Ingen ændringer i `QualificationCountdown.tsx` eller `LeagueRulesSheet.tsx`

