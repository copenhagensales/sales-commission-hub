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

## Scope og risiko

- **Én fil:** `src/components/layout/AppSidebar.tsx`.
- Ingen ændring af salgsdata, pricing, provision, løn, database eller rettighedsrækker.
- Ændringen berører adgangsvisning og behandles derfor som rød zone med denne plan som godkendelsesgrundlag.