

## Flyt "Turneringsregler" under "Formand" og gør den mere synlig

Lige nu ligger `LeagueRulesSheet compact` på **samme linje** som "Formand: Oscar Belcher" med en `·` separator. Den skal flyttes til sin **egen linje under** formand-teksten og gøres mere synlig.

### Ændringer i `CommissionLeague.tsx` (linje 304-308)

Erstat den nuværende `flex items-center gap-3` div med to separate linjer:

```tsx
<span className="text-xs text-muted-foreground/60 mt-1">Formand: Oscar Belcher</span>
<div className="mt-1">
  <LeagueRulesSheet compact />
</div>
```

### Ændringer i `LeagueRulesSheet.tsx` — compact-varianten

Gør compact-knappen mere synlig:
- Ændr fra `text-muted-foreground/60` til `text-muted-foreground` med en subtil border/baggrund
- Tilføj en lille `bg-primary/10 border border-primary/20 rounded-md px-2 py-0.5` styling så den ligner en klikbar badge
- Behold `text-xs` størrelse og `Info`-ikon + "Turneringsregler" tekst
- Hover: `hover:bg-primary/20 hover:border-primary/30`

