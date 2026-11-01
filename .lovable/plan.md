# Fibertæller på Relatel-boardet

## Hvad brugeren ser
- KPI-kortene (Salg i dag / uge / måned / lønperiode) får "(+N fiber)" ved siden af det eksisterende "(+N switch)", i samme stil.
- I sælgerlisterne (Top i dag / uge / lønperiode) står fiber ved siden af switch: "29 salg · 12 switch · 2 fiber" (og en fiber-kolonne i tabelvisningen ved siden af Switch).
- Kun Relatel-sælgere vises; TDC Erhverv-sælgere kommer ikke med på Relatel-boardet.
- Ét fiberlead fra en Relatel-sælger tæller 1 (på TDC Erhverv-boardet er det fortsat 0,5 — uændret).

## Regler
- Relatel kan kun lave leads, så kun "Lead Provi"-produkterne (HAP/VOK, med/uden Mobilevoice — 4 stk.) tæller på Relatel, 1 pr. stk.
- Tælles på leadgiverens arbejdsmail, og kun hvis vedkommende er aktiv på Relatel-teamet.
- Afviste salgsdele (fx leaddel afvist ved rettelse lukket→fuldt) og annullerede tæller ikke — samme regel som TDC-tælleren.
- Fiber tæller ikke med i "salg" eller provision på boardet (forbliver bisalg); kun som separat tal ved siden af.
- Gælder både manuelt tastede leads og leads fra Adversus.

## Hvad ændres ikke
- TDC Erhverv-boardet, dets 0,5/1,0-point og fibertæller.
- Provision, løn, prisregler, produkter, rettigheder, database.
- Ingen afsendelser, ingen publicering.

## Teknisk
- `src/config/fiberBoardPoints.ts`: ny map `RELATEL_FIBER_LEAD_POINTS` (4 Lead Provi-id'er → 1.0). Spejles i `tv-dashboard-data` (eksisterende test udvides til at sammenligne begge lister).
- `supabase/functions/tv-dashboard-data/index.ts`: ny action `relatel-fiber-stats` (start/end) → pr. medarbejder antal leads + total, filtreret til aktive medlemmer af Relatel-teamet via `team_members`, ekskl. `is_cancelled`/`validation_status='rejected'`. Cache som de øvrige. Udrulles.
- Nye hooks i samme mønster som `useFiberSalesCount`/`useFiberBoardStats` (eller parameter på eksisterende) — bruges kun når `features.relatelFiber === true`.
- `ClientDashboard.tsx`: ny feature-flag `relatelFiber`; tilføjer fiber-suffix på KPI-kort og fiberantal på sælgerrækker ved siden af switch. Ingen fiber-only sælgere tilføjes uden for Relatel-teamet.
- `src/pages/RelatelDashboard.tsx`: `relatelFiber: true`.
- Kontrol: test for pointlister, typecheck/build, read-only optælling af nuværende Relatel-leads i lønperioden sammenholdt med boardet, skærmbillede af boardet (desktop; TV-sider urørte i layout).
