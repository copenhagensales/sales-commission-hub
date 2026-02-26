
# Forbedret Tidslinje: Vis alle cron-jobs inkl. meta og kollisioner

## Problem

1. **Forkert config for Relatel**: `config.sync_schedule` viser `3,8,13,...` (Lovablecph's schedule), men det faktiske cron job er `0,5,10,15,...,55`. TimelineOverlap bruger config-data, sa den viser forkerte tidspunkter.

2. **Meta-jobs mangler**: Tidslinjen viser kun sales-schedule. Men der er 4 jobs i alt:
   - Lovablecph Sales: :03, :08, :13, :18, :23, :28, :33, :38, :43, :48, :53, :58
   - Lovablecph Meta: :05, :35
   - Relatel Sales: :00, :05, :10, :15, :20, :25, :30, :35, :40, :45, :50, :55
   - Relatel Meta: :10, :40

3. **Kollisioner**: Med 2 min threshold kolliderer de pa :05, :10, :15, :25, :35, :40, :45, :55 (8 pr. time for sales alene). Meta-jobs forvarrer det yderligere.

## Losning

### 1. Brug faktiske cron-jobs i stedet for config

I stedet for at laese `config.sync_schedule` (som kan vaere forkert), henter vi de faktiske cron-jobs fra `cron.job`-tabellen via den eksisterende `get_active_cron_jobs` RPC. Sadan far vi sandheden om hvad der rent faktisk korer.

### 2. Udvid TimelineOverlap til at vise sales + meta som separate rækker

Hver integration far to rækker i tidslinjen:
- `Lovablecph Sales` (bla)
- `Lovablecph Meta` (gra/sekundaer farve)
- `Relatel Sales` (bla)
- `Relatel Meta` (gra/sekundaer farve)

Kollisioner markeres rodt som nu, men nu detekteres de korrekt pa tvaers af alle 4 jobs.

### 3. Fix Relatel config (data-rettelse)

Opdater `dialer_integrations.config.sync_schedule` for Relatel sa den matcher det faktiske cron job: `0,5,10,15,20,25,30,35,40,45,50,55 * * * *`.

## Tekniske detaljer

### Fil: `src/components/system-stability/TimelineOverlap.tsx`
- Modtag en ny prop `cronJobs?: { jobname: string; schedule: string }[]` (fra LiveCronStatus/parent)
- Fallback: brug `config.sync_schedule` hvis cron-data ikke er tilgaengelig
- Split hver integration i sales/meta-rækker baseret pa jobname-pattern (`*-sync-sales`, `*-sync-meta`)
- Farvekodet: sales = primary, meta = secondary/muted
- Overlap-detektion korer pa alle jobs (sales+meta)

### Fil: `src/pages/SystemStability.tsx`
- Hent cron-jobs via eksisterende `get_active_cron_jobs` RPC
- Send dem som prop til `TimelineOverlap`

### Database: Fix Relatel config
- Opdater `dialer_integrations` config for Relatel (id: `657c2050-...`) med korrekt `sync_schedule`: `0,5,10,15,20,25,30,35,40,45,50,55 * * * *` og `meta_sync_schedule`: `10,40 * * * *`

## Forventet resultat

Tidslinjen viser 4 rækker med korrekte tidspunkter og tydelige kollisionsmarkeringer, sa man med et blik kan se hvor Relatel og Lovablecph rammer Adversus API'et samtidigt.
