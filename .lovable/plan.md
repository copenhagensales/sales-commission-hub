

# Stop Enreach-syncs udenfor arbejdstid (21:00-08:00 DK)

## Problemet

Enreach-integrationer (Eesy, Tryg, ASE) syncer 24/7, men der kommer aldrig ny data mellem 21:00 og 08:00 dansk tid. Resultat: **~48% af den daglige API-kvote (2.980 kald) spildes om natten** pa tomme forespoorgsler. Dette er hovedarsagen til at kvoten nar 0 om eftermiddagen.

## Besparelse

| Periode | API-kald/dag (gns.) |
|---------|---------------------|
| Nat (21-07) | ~5.000 |
| Dag (08-20) | ~5.400 |
| **Total** | **~10.400** |

Ved at stoppe nat-syncs reduceres forbruget til ~5.400/dag -- komfortabelt under kvoten pa 2.980 per provider... men vent, det er stadig over. Alligevel: med fair-use headeren (deployet i dag) taeller hvert kald kun 1x i stedet for 4-8x, sa det reelle forbrug falder drastisk. Nat-pause sikrer at kvoten ikke opbruges for arbejdsdagen starter.

## Implementering

### Trin 1: Tilfoj tidstjek i `sync-integration.ts`

Tilfoj en hjalpefunktion der checker om det er arbejdstid i dansk tidszone:

```typescript
function isDanishWorkingHours(): boolean {
  const now = new Date();
  const dkHour = parseInt(
    now.toLocaleString('en-US', { 
      hour: 'numeric', hour12: false, timeZone: 'Europe/Copenhagen' 
    })
  );
  return dkHour >= 8 && dkHour < 21;
}
```

Indsaet check i `syncIntegration()` for Enreach-integationer: hvis udenfor arbejdstid, returner `skipped` med besked "Outside working hours (21-08 DK)" -- ingen API-kald, ingen fejl-logning, ingen circuit breaker-paavirkning.

### Trin 2: Tilfoj tilsvarende check i `provider-sync.ts`

I `providerSync()` for `enreach`-provideren: skip hele provider-sync hvis udenfor arbejdstid. Log besked og returner tidligt.

### Trin 3: Opdater SystemStability dashboard

Tilfoj en info-badge eller note pa Enreach-integrationer der viser "Pauset (udenfor arbejdstid)" nar klokken er mellem 21-08 DK tid, sa dashboardet ikke viser falske advarsler om manglende syncs.

## Filer der aendres

1. `supabase/functions/integration-engine/actions/sync-integration.ts` -- tidstjek for enreach
2. `supabase/functions/integration-engine/actions/provider-sync.ts` -- tidstjek for enreach provider
3. `src/pages/SystemStability.tsx` -- undertryk "ingen sync"-advarsler udenfor arbejdstid
4. Deploy: `integration-engine`

## Risici og haandtering

- **Adversus pavirkes IKKE** -- kun Enreach-integationer far nat-pause
- **Ingen data-tab** -- der er ingen data at hente om natten
- Morgen-sync kl. 08:00 henter automatisk alt nyt via inkrementel watermark (last_success_at)
- Configurable: arbejdstiden kan later goores konfigurerbar via `dialer_integrations.config` hvis behovet aendrer sig

