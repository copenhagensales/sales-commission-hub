

# Enrichment Catch-Up: Hent telefonnumre for ~2.340 feb-salg

## Situationen
- **2.340 pending** Adversus-salg fra februar mangler telefonnummer (1.983 Lovablecph + 357 Relatel)
- Adversus API-limit: **1.000 kald/time per konto** (60/min)
- Nuværende healer: 20 batch, 150/hr budget, kører hvert 15. min = **~80/time** → ville tage **29 timer**
- Lovablecph og Relatel er **separate Adversus-konti** med hver deres limit

## Plan: Turbo-mode i 2 timer

Midlertidigt øg healer-kapaciteten og kør begge konti parallelt:

| Parameter | Nu | Turbo |
|-----------|-----|-------|
| maxBatch | 20 | 80 |
| Adversus budget | 150/hr | 800/hr |
| Cron-interval | 15 min | 5 min |
| Delay per sale | 1500ms | 1200ms |

**Throughput**: ~80 sales × 12 runs/hr = **~960/hr per konto**. Med 2 konti parallelt: ~1.920/hr.  
**Estimat**: ~1,5 timer for alle 2.340 salg.

### Ændringer

**1. `enrichment-healer/index.ts`** — Tilføj `turboMode` parameter:
- Når `turboMode: true`: batch=80, budget=800, delay=1200ms
- Når false/default: eksisterende værdier (ingen breaking change)

**2. Midlertidig cron-opdatering** (SQL insert):
- Skift cron fra `3,18,33,48 * * * *` til `*/5 * * * *` med `maxBatch: 80`
- **Vigtigt**: Kører kun i 2 timer, derefter sætter vi cron tilbage

**3. Efter catch-up** — Gendan normal cron:
- Sæt cron tilbage til `3,18,33,48 * * * *` med `maxBatch: 20`
- Turbo-koden forbliver i healeren som opt-in, ingen skade

### Sikkerhed
- Adversus limit er 1.000/hr — vi bruger 800 og efterlader 200 til normal sync
- Regular syncs bruger pt. kun ~16 kald/time (Lovablecph) og ~12 (Relatel)
- Circuit breaker og 429-retry er stadig aktive
- Kører i arbejdstid hvor vi kan monitorere

### Resultat
- ~2.340 Tryg/TDC/Finansforbundet/Codan-salg fra februar får telefonnummer
- Sales Validation-tallet falder fra 1.012 til tæt på 0
- Normal drift genoptages efter ~2 timer

