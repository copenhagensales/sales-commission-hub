

# TDC Erhverv Lovablecph — 418 salg mangler stadig OPP

## Status
| Enrichment status | Antal | Bemærkning |
|---|---|---|
| pending (mangler OPP) | **418** | Aldrig forsøgt (`enrichment_last_attempt = null`) |
| failed | 34 | Allerede forsøgt, lead data udløbet i Adversus |
| healed | 333 | Succesfuldt beriget i sidste kørsel |

## Problem
De 418 pending salg blev aldrig nået i den forrige kørsel — funktionen stoppede efter at have behandlet de første batches. Koden er korrekt og filtrerer allerede kun på `source = 'Lovablecph'` + TDC Erhverv campaign ID.

## Løsning
Ingen kodeændringer nødvendige. Funktionen skal blot køres igen:

```js
await supabase.functions.invoke('tdc-opp-backfill', { 
  body: { batchSize: 50, autoRun: true } 
})
```

- 418 salg × 1.05s delay ≈ **7-8 minutter** med autoRun
- Funktionen fortsætter automatisk i batches af 50
- Kun Lovablecph TDC Erhverv salg behandles
- Salg hvor Adversus returnerer "empty lead data" markeres som `failed` (lead slettet/genbrugt i Adversus — kan ikke hentes automatisk)

## Handling
Kun invokering af den eksisterende edge function — ingen fil-ændringer.

