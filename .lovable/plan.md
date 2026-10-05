# Omstilling på "Ny Implementering": tre trin, som sælger skal svare på

Ændringen gælder kun fanen "Ny Implementering". Standard og Pilot forbliver som i dag.

## Flow i formularen
```text
1. Har kunden omstilling?        ( ) Ja   ( ) Nej          <- skal vælges
   └ hvis Ja:
2. Hvilken omstilling?           ( ) Standard ( ) Professionel  <- skal vælges
   └ hvis Standard:
3. Har kunden menuvalg i dag?    ( ) Ja   ( ) Nej          <- skal vælges
```
- Ingen af valgene er forudvalgt. Sælgeren skal aktivt tage stilling til dem.
- Hvis et svar ændres til Nej eller Professionel, nulstilles de efterfølgende trin.
- Afkrydsningsfeltet "Kunden har menuvalg i dag" erstattes af Ja/Nej-valget.

## Tekst i opsummeringen
- **Nej til omstilling:** der kommer ingen tekst om omstilling.
- **Ja + Professionel:** "I forhold til jeres omstilling og hvordan den skal virke …".
- **Ja + Standard + menuvalg Ja:** første linje + "Som aftalt, så har du med denne omstilling mulighed for at have ét nul-valg …".
- **Ja + Standard + menuvalg Nej:** første linje + "Hvis du i fremtiden for brug får menuvalg, er det muligt at tilkøbe."
- **Mangler der et svar:** der står en rød besked i teksten, f.eks. "(Vælg om kunden har omstilling)", "(Vælg Standard eller Professionel)" eller "(Vælg om kunden har menuvalg i dag)". Så kan sælgeren se, at der mangler et svar.

## Tekniske detaljer
- `TdcOpsummeringForm.tsx`: tre nye `boolean | null`-tilstande (`implHasOmstilling`, `implIsStandard`, `hasMenuToday`), som kun bruges, når `summaryVariant === "implementering"`. Den nuværende Pilot-switch og det nye afkrydsningsfelt vises ikke på denne fane.
- `generateSummary.ts`: `hasMenuToday` bliver `boolean | null`, og omstillingsgrenen for `implementering` læser de tre værdier. Der tilføjes engelske oversættelser af de tre røde beskeder.
- Kun visning og tekst. Ingen ændringer i databasen.
