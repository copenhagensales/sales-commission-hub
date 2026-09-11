# Oprydning i opkaldsdata (dialer_calls)

## Hvad der er bekræftet i data og kode

- `dialer_calls`: 531.331 opkald, ældste 7. november 2024. Ingen automatisk oprydning rører tabellen i dag.
- 197.401 opkald er ældre end 180 dage. Af dem har 106.688 et link til lydoptagelse.
- `recording_url` er sat på i alt 307.275 opkald og vises kun i den rå datatabel (`CallsDataTable.tsx`). Ingen rapport, KPI eller beregning bruger feltet.
- `metadata` indeholder kundens telefonnummer (`number`) og medarbejderens mail (`agentEmail`) på 16.333 Enreach-opkald — alle ældre end 180 dage. Ingen rapport læser dem; `agentEmail` bruges kun under import til at finde `agent_id`.
- `lead_external_id` skrives ved import, men læses aldrig i rapporter. Det er dialerens lead-nøgle og kan slås tilbage til en person i dialerens eget system.
- Statistikken (opkaldstal, samtaletid, svarprocent, hitrate på dashboards, TV-boards og head-to-head) bruger kun: tidspunkt, varighed, status, disposition, retning, agent og kampagne.

## Beslutning bag planen

Opkald uden salg skal blive ved med at findes — de er nævneren i "salg pr. opkald". Men de skal kun indeholde tekniske felter. Alt der kan kobles til en person fjernes: nu på det eksisterende, og fremover ved indtaget.

## Del 1 — Stop personoplysninger ved indtaget

I `supabase/functions/integration-engine/core/calls.ts`:

- Gem ikke længere `recording_url` (skrives som `null`).
- Filtrér `metadata` gennem en positivliste før den gemmes: `disposition`, `hangupCause`, `callType`, `answerTime`, `direction`, `wrapUpDuration`, `dialingDuration`, `isSale`, `result`, `project`, `orgCode`. Alt andet — herunder `number` og `agentEmail` — kasseres.
- `agentEmail` bruges fortsat i selve importen til at finde `agent_id`; den gemmes blot ikke.
- Samme positivliste lægges i `_shared` så både Adversus- og Enreach-vejen bruger den ene funktion.
- `incoming-call` (Twilio) gennemgås for samme mønster og rettes efter samme regel.

Ingen ændring i hvor mange opkald der importeres, og ingen ændring i eksisterende beregninger.

## Del 2 — Engangsoprydning af det der allerede ligger

Tre kontrollerede opdateringer på `dialer_calls`, hver med optælling før og efter:

1. `recording_url` sættes til tom på alle 307.275 opkald.
2. `number` og `agentEmail` fjernes fra `metadata` på alle 16.333 Enreach-opkald.
3. `lead_external_id` nulstilles på opkald ældre end 180 dage.

Opkaldenes tekniske felter røres ikke, så alle opkaldstal og hitrates er uændrede efter oprydningen. Optagelseslinket i den rå datatabel bliver tomt — lydfilerne ligger fortsat hos dialeren, ikke hos os.

## Del 3 — Daglig oprydning fremover

- Ny linje i `data_retention_policies`: `dialer_calls`, visningsnavn "Opkaldsdata", 180 dage, tilstand `anonymize`, aktiv.
- Ny sektion i `gdpr-data-cleanup` (samme mønster som `fieldmarketing_sales`, mængdebaseret så 1000-rækkes-grænsen ikke skjuler rækker): på opkald ældre end fristen ryddes `recording_url`, `lead_external_id` og eventuelle rester i `metadata`. Selve opkaldsrækken slettes ikke.
- Kørslen tælles med i jobbets logstatistik under nøglen `dialer_calls_anonymized`, så tallet fremgår i oprydningsloggen.
- Ingen nyt cron-job. Det eksisterende daglige job kl. 03:30 UTC dækker det. Del 1 gør sektionen til en bagstopper frem for den primære beskyttelse.

## Del 4 — Kontrol

- Tørkørsel af oprydningsjobbet før den rigtige kørsel, med rapport over hvor mange rækker der rammes.
- Optælling efter oprydning: nul opkald med optagelseslink, nul med telefonnummer i metadata, nul lead-nøgler ældre end 180 dage.
- Kontrol af at samlet antal opkald, samtaletid og hitrate for en valgt måned er præcis det samme før og efter.
- Import af et nyt opkald verificeres: telefonnummer og optagelseslink gemmes ikke, `agent_id` bliver fortsat sat korrekt.
- Typecheck.

## Rører ikke

Salg, provision, `sale_items`, lønsider, auth/RLS, rapporter, leverandør-/uge-/dagsrapporter og de øvrige sektioner i oprydningsjobbet.

## Åbent punkt

Fristen sættes til 180 dage for at følge kampagnernes egen politik. Skal opkaldsdata have en anden frist end salgsdata, siger du til inden Del 3 køres.
