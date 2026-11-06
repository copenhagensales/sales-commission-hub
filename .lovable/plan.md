# TDC Månedsmål: Relatel-fiberleads ud af fællesmålet

## Mål
På TDC Månedsmål-tavlen skal fællesmålet og dagsboksene kun tælle TDC-sælgernes egne salg og leads. Relatel-sælgernes fiberleads (i dag 0,5 point pr. stk.) fjernes derfra.

## Uændret
- Relatel Månedsmål: Relatel-leads tæller fortsat 1 pr. stk.
- TDC-sælgerlisten (var allerede kun TDC-teamet).
- Provision, omsætning, salg, satser og lønperiode røres ikke. Kun visning på tavlen.
- Fibertavler og TDC/Relatel-dashboards uændrede.

## Ændring
I tavlens datakilde for TDC Månedsmål (`handleMonthlyGoal` i `supabase/functions/tv-dashboard-data/index.ts`, kun når kunden er TDC Erhverv): frasortér salgslinjer, hvor produktet er et Lead Provi-fiberprodukt og sælgeren var på Relatel-teamet, da leadet blev lavet. Til det genbruges den regel, Relatel-tavlen allerede bruger (`getRelatelEmailToEmployee` + `relatelLeadCounts`), så "hvem er Relatel-sælger" kun er defineret ét sted.

TDC-sælgernes egne leads (0,5) og fulde salg tæller som før.

## Kontrol
- Typecheck af edge-funktionen; udrul kun `tv-dashboard-data`.
- Sammenlign antal før/efter for november: forskellen skal svare til Relatel-leads × 0,5 (kun antal, ingen navne).
- Ingen afsendelser, ingen data ændres.
