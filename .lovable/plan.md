

## Flyt "Turneringsregler" under "Formand: Oscar Belcher" som kompakt knap

### Ændringer

**1. `LeagueRulesSheet.tsx`** — Tilføj `compact` prop:
- Når `compact={true}`: render en lille inline-knap med Info-ikon og teksten "Turneringsregler" i `text-xs` stil, uden border-box — matcher "Formand" linjen visuelt.

**2. `CommissionLeague.tsx`**:
- **Fjern** linje 324-325 (`<LeagueRulesSheet />`).
- **Indsæt** `<LeagueRulesSheet compact />` i linje 304-306, inden i `flex items-center gap-3` div'en, efter "Formand: Oscar Belcher":

```text
Sæson 1  [Fan]
Kvalifikationsrunde • 69 spillere
Formand: Oscar Belcher  · (i) Turneringsregler
```

Kompakt-knappen bliver en lille `text-xs text-muted-foreground/60 hover:text-primary` link-style trigger med Info-ikon.

