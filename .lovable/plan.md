

# Gør rival-afstandsbaren mere tydelig

## Problem
Baren er for lille og diskret — `text-[10px]`, `h-2` bar, og placeret som et appendiks under progress-baren. Den drukner i layoutet.

## Forslag

### 1. Flyt baren op — direkte under zone-indikatoren
Placer den lige efter "⚠️ Nedrykningszone" / "✅ Oprykningszone" boksen og **før** motivational quote. Det giver kontekst: zonen fortæller *hvor* du er, baren fortæller *hvor tæt* rivalerne er.

### 2. Gør den visuelt større og tydeligere
- **Højere bar**: Fra `h-2` → `h-3` med en `ring-1 ring-border` kant
- **Større tekst**: Fra `text-[10px]` → `text-xs` (12px)
- **Større markør**: Fra `h-3.5 w-3.5` → `h-4 w-4` med en pulsende `ring-2 ring-primary/30` glow
- **Overskrift**: Tilføj en lille "Afstand til rivaler" label over baren
- **Stærkere farver**: `bg-green-500/40` → `bg-green-500/50`, `bg-amber-500/30` → `bg-amber-500/40`
- **Ikoner større**: `h-3 w-3` → `h-3.5 w-3.5`

### 3. Tilføj subtil baggrund
Wrap hele rival-sektionen i en `rounded-lg bg-slate-800/40 p-3` boks så den visuelt skiller sig ud som sin egen sektion.

## Fil der ændres
**`src/components/league/MyQualificationStatus.tsx`** — flyt rival-blokken op (efter zone-indicator, før motivation quote) og forstør alle visuelle elementer.

