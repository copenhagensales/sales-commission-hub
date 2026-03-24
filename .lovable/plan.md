

# TDC OPP Backfill — kun Lovablecph

## Status
Den eksisterende `tdc-opp-backfill` funktion håndterer allerede **kun** Lovablecph-salg med TDC Erhverv campaign ID. Ingen ændringer er nødvendige i koden.

## Kørsel
Funktionen er klar og kan startes med ét kald:

```js
await supabase.functions.invoke('tdc-opp-backfill', { 
  body: { batchSize: 50, autoRun: true } 
})
```

- 387 salg × 1.05s delay = ~7 minutter med autoRun
- Funktionen fortsætter automatisk til alle er behandlet
- Relatel-salg røres **ikke**

## Handling
Ingen kodeændringer — kun invokering af den eksisterende funktion.

