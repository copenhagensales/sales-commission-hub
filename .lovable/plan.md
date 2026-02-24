
Mest sandsynlige årsag er fundet, og den er konkret:

1) Der kører dobbelt sync-arkitektur samtidig
- Både per-integration jobs er aktive:
  - `dialer-d79b9632-sync` (Eesy)
  - `dialer-a5068f85-sync` (tryg)
  - `dialer-a76cf63a-sync` (ase)
  - `dialer-657c2050-sync` (Relatel)
  - `dialer-26fac751-sync-sales` + `dialer-26fac751-sync-meta` (Lovablecph)
- Og provider-jobs er også aktive:
  - `provider-enreach-sync` (*/3)
  - `provider-adversus-sync` (*/5)

Det betyder i praksis at samme integrationer bliver trigget flere gange inden for samme få sekunder/minutter.

2) Data bekræfter dobbelt-kørsler
- Enreach-runs har gennemgående dobbeltkørsler:
  - Fx Eesy har 2 runs samme minut igen og igen.
- Hver Enreach-run ligger på:
  - `api_calls_made=12`
  - `rate_limit_hits=12`
  - `retries=9`
  - Altså ren 429-loop.
- PostgreSQL logs viser også lock-konflikt på `provider_sync_locks`:
  - `duplicate key value violates unique constraint "provider_sync_locks_pkey"`
  - Det er et tegn på overlap i provider-sync triggere.

3) “Var det ændringer i dag?”
- Der er ingen schedule-audit entries i dag; seneste schedule-ændringer ligger i går (2026-02-23 omkring 17:47 UTC).
- Så problemet ligner ikke en ny kodeændring i dag, men en eksisterende konfiguration der nu giver burst/overlap under belastning.
- At det virkede i morges passer med dette: lavere load tidligere + senere overlap/burst => 429-storm.

4) Sekundær design-fejl der forværrer problemet
- Budgetstyring er primært per time (fx Enreach 10.000/time), men fejlmønstret er per-minut burst.
- Derfor “ser budget fint ud” samtidig med at alle kald bliver afvist.

Implementeringsplan (jeg udfører den efter godkendelse)
Fase A — Stop blødningen (hurtig stabilisering)
1. Deaktivér én af de to sync-strategier, så kun én orkestrering er aktiv.
   - Anbefaling nu: behold per-integration jobs, deaktivér `provider-enreach-sync` og `provider-adversus-sync`.
   - Begrundelse: nuværende dialer-jobs har allerede fine offsets + Lovablecph split sales/meta.
2. Verificér at kun ét job per integration er aktivt i `cron.job`.
3. Overvåg 15-30 min:
   - 429-rate skal falde markant.
   - `last_sync_at` må ikke stagnere.
   - `integration_sync_runs` må ikke have dublet-runs samme minut for samme integration.

Fase B — Gør løsningen robust (så det ikke kommer igen)
4. Indfør “mutual exclusivity guard” i scheduler-logik:
   - Når provider-mode er ON: ingen dialer-* sync jobs må eksistere.
   - Når dialer-mode er ON: ingen provider-* jobs må eksistere.
5. Opdatér System Stability visning:
   - Vis kritisk advarsel hvis både provider-jobs og dialer-jobs er aktive samtidig.
6. Tilføj per-minute budget gate (ikke kun per-hour):
   - Enreach/Adversus stop eller skip tidligt hvis minute-window er over threshold.
7. Stram retry/backoff for Enreach:
   - Mere jitter + adaptiv cooldown efter gentagne 429.
   - Undgå at alle integrations løber i samme retry-rytme.

Fase C — Verifikation og acceptkriterier
8. Acceptance checks:
   - Enreach 429-rate < 10% over 30 min.
   - Adversus 429-rate signifikant ned ift. nu.
   - Ingen “duplicate minute runs” for samme integration.
   - Lovablecph sync recovers (ingen “ingen sync i 37 min”).
9. Hvis stadig høje 429:
   - Midlertidigt sænk actions pr. run (fx split metadata/sales mere aggressivt)
   - Øg interval for de mest tunge integrationer.

Teknisk note
- Rodårsag er ikke “pricing rule rematch” eller løn-siderne.
- Rodårsag er scheduler-konflikt + minute-burst mod eksterne API’er.
- Det er derfor helt konsistent med “virkede i morges, men brød senere”.

Når du godkender, tager jeg Fase A først (hurtig stabilisering), og derefter Fase B hardening.
