# Plan: Robust opdelt Kampagneoversigt Tryg

## Bekræftet evidens
- `supabase/functions/weekly-lead-closure-report/index.ts:812-820` opretter ét Adversus-job pr. kampagne med alle valgte uger samlet; det opfylder ikke kravet om én `(konto, kampagne, uge)`-kombination pr. task.
- `index.ts:535-552` har allerede sidevis fortsættelse og gemmer delresultater efter hvert kald.
- `index.ts:761-785` kæder næste kald asynkront, og `1031-1054` afslutter først efter køen er tom.
- `src/pages/reports/WeeklyLeadClosureReport.tsx:586-628` viser kun samlede kampagner/emner og ikke done/pending/error.

## Ændringer
1. Opret `weekly_lead_closure_tasks` med én række pr. konto, kampagne og uge, sideposition, forsøg, status, fejloplysning og antal scannede emner. Tilføj begrænset læseadgang, RLS, indeks og atomisk task-udtagning.
2. Flyt funktionen fra jobkøen til taskkøen. Ét kald behandler højst én task og en begrænset sideblok; delresultater gemmes straks og tasken fortsætter fra gemt sideposition.
3. Behold asynkron selvkædning. Fortsæt efter fejl, afslut først når alle tasks er `done` eller `error`, og medtag fejl nederst i mailen.
4. Udvid React Query-hook og siden, så hver kørsel viser antal done, pending/running og error. Aktiv kørsel genindlæses automatisk.
5. Markér præcis dagens fire relevante hængende kørsler som `timeout – afløst af opdelt kørsel` uden at ændre historiske afsluttede kørsler.
6. Deploy funktionen, kør database- og sikkerhedskontrol, start en fuld 8-ugers kørsel og kontrollér slutstatus samt sidste hele uges ni rapportlinjer.

## Sikkerhed og afgrænsning
- Feltbegrænsning, domænefilter, statusklassificering, mapping og mailindhold ændres ikke.
- Lederne-sync og webhook-flow røres ikke.
- Ingen lead-data gemmes; kun aggregerede tællinger og driftsstatus gemmes.
