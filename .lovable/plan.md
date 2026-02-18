
# Fix: Lovablecph synkroniserer ikke TDC-salg

## Rodaarsag

To separate problemer forhindrer Lovablecph i at synkronisere salg:

### Problem 1: Gammelt cron-job stjæler API-kvoten
Det gamle job `adversus-sync-nightly` (jobid 1) koerer stadig:
- Schedule: `0 0-6 * * *` (hver time kl. 00-06)
- Kalder den **gamle** `sync-adversus` edge function
- Bruger **samme Adversus API-credentials** som Lovablecph
- Resultatet: API-kvoten er opbrugt inden Lovablecph naar at synkronisere

Bevis: 16 ud af 20 sync-forsog i dag fejlede med "Rate Limit Adversus Excedido".

### Problem 2: Synkroniseringsvindue for kort
Det nye cron-job sender `days: 1`, men efter en hel dag med rate-limit fejl er der et backlog. Salg fra i morges naar ikke at blive hentet med kun 1 dags vindue.

---

## Loesning

### Trin 1: Slet det gamle cron-job
Fjern `adversus-sync-nightly` (jobid 1) via SQL:
```text
SELECT cron.unschedule(1);
```
Dette job er erstattet af de nye staggerede jobs og skal ikke koere laengere.

### Trin 2: Udvid synkroniseringsvinduet midlertidigt
Opdater Lovablecph cron-job til `days: 3` midlertidigt for at indhente backlog:
```text
UPDATE cron.job 
SET command = '...(days: 3)...'
WHERE jobid = 47;
```

### Trin 3: Koer en manuel sync nu
Trigger en umiddelbar sync med `days: 3` for Lovablecph for at hente alle manglende TDC-salg med det samme.

### Trin 4: Sæt vinduet tilbage til 1 dag
Naar backlogget er indhentet (efter 1-2 timer), saet `days` tilbage til `1` for at minimere API-belastning.

---

## Forventet resultat
- Ingen flere rate-limit fejl (det gamle job bruger ikke laengere API-kvoten)
- Alle TDC Erhverv salg fra i dag synkroniseres inden for minutter
- Fremadrettet stabil synkronisering hvert 5. minut
