# TDC Månedsmål — nyt board

Et nyt board der kan vises på skærm (TV) og i dashboard-oversigten: TDC Erhverv-teamets samlede månedsmål plus individuelle mål pr. sælger, begge med progressbar.

## Hvad boardet viser

- **Fælles mål (øverst):** stor progressbar — antal solgte produkter i indeværende måned på TDC Erhverv vs. hardkodet teammål. Viser antal, mål, procent og rest.
- **Individuelle mål (nedenunder):** én række pr. aktiv sælger på TDC Erhverv-teamet med navn, antal, mål og progressbar. Sælgere uden salg vises med 0.
- Sorteret efter opnåelsesprocent. Farvemarkering ved 100 % opnået.
- TV-venligt mørkt layout i fuld skærmhøjde, auto-refresh (samme mønster som Powerdag-boardet).

## Datagrundlag

- Salg: `sales` for klient TDC Erhverv (`client_campaigns.client_id`) i perioden 1. i måneden → nu.
- Tælleenhed: **sum af `sale_items.quantity`** (antal produktlinjer).
- Sælgere: aktive medarbejdere på TDC Erhverv-teamet; salg kobles på `agent_email` → `work_email`.
- Annullerede salg holdes ude (samme filter som øvrige TDC-visninger).

## Mål (hardkodet, opdateres måned for måned)

Målene lægges i én config-fil pr. måned, fx:

```text
2026-09:
  team: <fælles mål>
  sellers:
    Navn 1: <mål>
    Navn 2: <mål>
```

Jeg mangler tallene fra dig: **fælles mål for september 2026** og **individuelt mål pr. sælger**. Hvis alle sælgere har samme mål, kan der sættes én standardværdi i stedet for en liste. Når en ny måned starter, tilføjes en ny blok i samme fil.

## Adgang og placering

- Ny slug `tdc-monthly-goal`, sti `/dashboards/tdc-monthly-goal`, navn "TDC Månedsmål".
- Ny permission-nøgle `menu_dashboard_tdc_monthly_goal` (samme mønster som `menu_dashboard_tdc_erhverv`), så adgang styres i rettighedssystemet.
- Registreres i TV-board-visningen, så boardet kan vælges til en skærm via TV-kode ligesom de øvrige boards.

## Teknisk

- Ny side `src/pages/dashboards/TdcMonthlyGoalBoard.tsx` + hook `src/hooks/useTdcMonthlyGoal.ts` (React Query, ingen Supabase-kald i komponenten).
- Ny config `src/config/tdcMonthlyGoals.ts` med målene pr. måned.
- Tilføjes i `src/config/dashboards.ts`, `src/routes/config.tsx`, `src/config/permissionKeys.ts` og `src/pages/tv-board/TvBoardView.tsx`.
- Ingen databaseændringer, ingen ændringer i eksisterende TDC-hooks eller lønlogik.
