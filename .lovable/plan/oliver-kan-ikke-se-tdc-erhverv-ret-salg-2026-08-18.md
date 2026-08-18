# Oliver kan ikke se “TDC Erhverv - ret salg”

## Konklusion

Oliver er korrekt opsat i databasen. Fejlen ligger i sidemenuens overordnede visningsbetingelse:

- Oliver er aktiv og har stillingen **“Salgskonsulent (TDC ret salg)”** med rollen `salgskonsulent_tdc_support`.
- Rollen har `can_view = true` på både `menu_section_reports` og `menu_reports_tdc_edit_sales` samt `can_edit = true` på TDC-rettigheden.
- Selve menupunktet bruger korrekt `p.canViewReportsTdcEditSales` (`src/components/layout/AppSidebar.tsx:1366`).
- Men hele Rapporter-sektionen vises kun, hvis brugeren har en af de øvrige rapportrettigheder eller adgang til annulleringer (`src/components/layout/AppSidebar.tsx:467-468`). TDC-rettigheden mangler i denne liste. Derfor bliver Olivers menupunkt aldrig renderet.

## Ændring

1. Tilføj `p.canViewReportsTdcEditSales` til den eksisterende `showReportsMenu`-betingelse i `src/components/layout/AppSidebar.tsx`.
2. Bevar alle eksisterende rettigheder og adgangsregler uændret. Ingen databaseændring er nødvendig.
3. Verificér, at:
   - Rapporter-sektionen og “TDC Erhverv - ret salg” vises for en bruger, der kun har sektions- og TDC-rettigheden.
   - Direkte adgang til siden fortsat beskyttes af `menu_reports_tdc_edit_sales`.
   - Brugere uden TDC-rettigheden ikke får menupunktet.

## Han får kun det ene punkt — bekræftet

Hvert punkt under Rapporter er gated individuelt på sin egen rettighed. Rollen `salgskonsulent_tdc_support` har `can_view = false` på alle øvrige:

- `menu_reports_admin`, `menu_reports_daily`, `menu_reports_management`, `menu_reports_employee`, `menu_reports_revenue_by_client`: nej.
- Annulleringer (`menu_cancellations` + alle `tab_cancellations_*`): nej.
- Løn-sektion (`menu_section_salary`, `menu_salary_types`): nej.

Ændringen åbner altså kun selve sektions-overskriften, så det ene punkt kan vises. De øvrige punkter forbliver skjulte, og deres ruter afviser ham fortsat ved direkte URL. Dette verificeres eksplicit efter ændringen.


## Scope og risiko

- **Én fil:** `src/components/layout/AppSidebar.tsx`.
- Ingen ændring af salgsdata, pricing, provision, løn, database eller rettighedsrækker.
- Ændringen berører adgangsvisning og behandles derfor som rød zone med denne plan som godkendelsesgrundlag.