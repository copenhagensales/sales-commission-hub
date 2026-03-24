

# Fix: Bil-afleverings email sendes ikke

## Problem
Edge-funktionen `notify-vehicle-returned` har **ingen logs overhovedet** — den er sandsynligvis ikke deployet. Koden eksisterer i `supabase/functions/notify-vehicle-returned/index.ts`, men funktionen er aldrig blevet deployet til Lovable Cloud.

Derudover bekræfter databasen at modtageropsætningen virker: FM-teamets assistant leader (Thomas) findes med en privat email.

## Løsning

| Ændring | Hvad |
|---------|------|
| **Deploy edge function** | Kør `deploy_edge_functions(["notify-vehicle-returned"])` for at deploye funktionen |
| **Verificer M365 secrets** | Tjek at `M365_TENANT_ID`, `M365_CLIENT_ID`, `M365_CLIENT_SECRET` og `M365_SENDER_EMAIL` er konfigureret som secrets (de bruges af 20+ andre funktioner, så de bør allerede være der) |
| **Test** | Bekræft aflevering igen og tjek at email ankommer |

Ingen kodeændringer nødvendige — kun deployment.

