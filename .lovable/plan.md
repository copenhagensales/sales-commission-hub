

## Udspecificér individuelle dashboards i rettighedskortet

### Problem
Dashboards-sektionen i rettighedskortet viser kun generelle entries ("Dashboards generelt", "Dashboard Administration" osv.), men ikke de **13 individuelle dashboards** (CPH Sales, Fieldmarketing, Eesy TM osv.). Deres permission keys (`menu_dashboard_cph_sales`, `menu_dashboard_fieldmarketing` ...) er defineret i `dashboards.ts` men mangler i `permissionKeys.ts`, som er den kilde rettighedskortet bruger.

### Løsning
Tilføj alle individuelle dashboard permission keys fra `DASHBOARD_LIST` til `PERMISSION_KEYS` i `permissionKeys.ts` under dashboards-sektionen.

### Ændringer

**Fil: `src/config/permissionKeys.ts`**

Tilføj under dashboards-sektionen (efter `menu_dashboard_settings`):

```
menu_dashboard_cph_sales:          { label: 'Dagsboard CPH Sales',   section: 'dashboards', parent: 'menu_section_dashboards' },
menu_dashboard_fieldmarketing:     { label: 'Fieldmarketing',        section: 'dashboards', parent: 'menu_section_dashboards' },
menu_dashboard_eesy_tm:            { label: 'Eesy TM',              section: 'dashboards', parent: 'menu_section_dashboards' },
menu_dashboard_tdc_erhverv:        { label: 'TDC Erhverv',          section: 'dashboards', parent: 'menu_section_dashboards' },
menu_dashboard_relatel:            { label: 'Relatel',              section: 'dashboards', parent: 'menu_section_dashboards' },
menu_dashboard_united:             { label: 'United',               section: 'dashboards', parent: 'menu_section_dashboards' },
menu_dashboard_test:               { label: 'Test Dashboard',       section: 'dashboards', parent: 'menu_section_dashboards' },
menu_dashboard_cs_top_20:          { label: 'CS Top 20',            section: 'dashboards', parent: 'menu_section_dashboards' },
menu_dashboard_sales_overview_all: { label: 'Salgsoversigt alle',   section: 'dashboards', parent: 'menu_section_dashboards' },
menu_dashboard_commission_league:  { label: 'Superliga Live',       section: 'dashboards', parent: 'menu_section_dashboards' },
menu_dashboard_powerdag:           { label: 'Powerdag',             section: 'dashboards', parent: 'menu_section_dashboards' },
```

Det er **én fil** med additive entries. Rettighedskortet og editoren viser dem automatisk, da begge bruger `generatePermissionCategories()` fra denne fil. Ingen risiko for regression.

