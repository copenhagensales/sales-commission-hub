# Excel: Relatel-salg pr. sælger, 1/10–31/10 2026

## Resultat
Én Excel-fil med to kolonner: **Sælger** og **Antal produkter**, sorteret efter antal (højest først), plus en totallinje. Intet andet (ingen mails, CPR, kunder eller beløb).

## Tælleregel (samme som Relatels månedsmål-board)
- Salgslinjer på Relatel-kampagner med salgsdato 1/10–31/10 (dansk tid), antal = linjens quantity.
- Annullerede og afviste salg tæller ikke.
- Produkter, som boardet udelukker (fx Internetfilter og de Relatel-specifikke undtagelser), tæller ikke.
- Fiberleads (Lead Provi HAP/VOK) tæller 1 stk., kun hvis sælgeren var på Relatel-teamet, da leadet blev lavet.
- Sælgere matches som på boardet: via deres dialer-mails og arbejdsmail.
- Medtager alle sælgere med salg i perioden, også dem der senere er stoppet eller skiftet team (boardet viser kun nuværende aktive). Sælgere med 0 salg udelades.

## Bemærkninger
- Fiberleads blev først koblet på månedsmålet i november; de tælles her med i oktober efter den nuværende regel.
- Read-only: intet i systemet ændres.

## Teknisk
- Udelukkede produkt-id'er læses fra `MONTHLY_GOAL_EXCLUDED_PRODUCT_IDS` og `RELATEL_MONTHLY_GOAL_EXCLUDED_PRODUCT_IDS`; fiberlead-id'er og teamstart fra `tv-dashboard-data` (`RELATEL_FIBER_LEAD_POINTS_EF`, `relatelLeadCounts`).
- Data via read-only SQL; fil bygges med Excel-værktøjet og gemmes som `relatel_salg_pr_saelger_okt-2026.xlsx` i Filer. Totallinje som SUM-formel, genberegnet og kontrolleret for fejl.
