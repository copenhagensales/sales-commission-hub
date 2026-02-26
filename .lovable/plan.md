

# Fix: Vis realistisk status-badge baseret på 429-hits og retries

## Problem
Status-badget i "Seneste Sync Runs"-tabellen viser grøn "OK" selvom en kørsel havde 3 rate-limit hits (429) og 2 retries. Årsagen er at backend markerer en kørsel som `success` så længe den til sidst gennemfører uden at kaste en fejl — uanset hvor meget friktion der var undervejs. UI'et viser derefter blindt grøn for alt med `status === "success"`.

## Løsning
Tilføj en visuel "degraderet" status i UI'et der tager højde for `rate_limit_hits` og `retries` — uden at ændre backend-logikken.

### Ændring i `src/pages/SystemStability.tsx` (kun UI-rendering)

I status-badge renderingen (linje ~408-421), tilføj en check **før** den grønne badge:

```text
Nuværende logik:
  success → grøn "OK"
  error → rød "Fejl"
  andet → gul badge

Ny logik:
  success + (rate_limit_hits > 0 ELLER retries > 0) → amber/gul "Degraderet" badge
  success + ingen 429/retries → grøn "OK"
  error → rød "Fejl"
  partial_success → gul "Delvis"
  andet → gul badge
```

Badget vil vise:
- **Grøn "OK"**: Ren kørsel uden problemer
- **Amber "Degraderet"** (med AlertTriangle ikon): Synkronisering gennemført, men med rate-limit hits eller retries — indikerer pres på API-kvoten
- **Rød "Fejl"**: Kørsel fejlede
- **Gul tekst**: partial_success, skipped_locked, osv.

### Ændring i status-cards (integrations-overblik)
Ingen ændring nødvendig — de bruger allerede aggregerede metrikker (`successRate1h`, `rateLimitRate15m`) som korrekt reflekterer problemer.

### Ingen backend-ændringer
Backend-status `success` er korrekt — synkroniseringen *gennemførte* faktisk. Det er kun den visuelle repræsentation i tabellen der skal nuanceres.

