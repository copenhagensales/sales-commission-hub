# Rekruttering-rollen får adgang til alle dashboards

Ændringen gælder rollen "Rekruttering". Én person har rollen i dag, Oscar. Alle andre med rollen får samme adgang.

## Status i dag (rolle-rettigheder, "se")
Rollen kan allerede se: Fieldmarketing, ASE FM, Eesy TM, TDC Erhverv, Relatel (og Relatel Produkter), United, CS Top 20, Salgsoversigt alle, Superliga Live og Powerdag.

Rollen mangler disse 8:
- Dagsboard CPH Sales
- TDC Månedsmål
- Eesy FM Månedsmål
- Yousee FM Månedsmål
- Eesy TM Månedsmål
- Relatel Månedsmål
- MG Test
- Test Dashboard

## Ændring
Rollen får kun "se" (`can_view = true`) på de 8 dashboards ovenfor i rolle-rettighederne. Ingen rediger-rettigheder ændres, og ingen kode ændres. Indstillinger for dashboards og admin forbliver lukket.

## Bemærk
MG Test og Test Dashboard er udviklingsdashboards. Godkender du planen, kommer de med, fordi du har bedt om "alle". Sig til, hvis de skal holdes ude.

## Tekniske detaljer
- Upsert i `role_page_permissions` for `role_key = 'rekruttering'` med nøglerne `menu_dashboard_cph_sales`, `menu_dashboard_tdc_monthly_goal`, `menu_dashboard_eesy_fm_monthly_goal`, `menu_dashboard_yousee_fm_monthly_goal`, `menu_dashboard_eesy_tm_monthly_goal`, `menu_dashboard_relatel_monthly_goal`, `menu_dashboard_mg_test` og `menu_dashboard_test`. Det sættes kun `can_view = true`, og andre kolonner bevares.
- Det er en dataændring (rød zone: auth/rettigheder), som du har godkendt eksplicit. Skemaet ændres ikke.
- Verifikation: forespørg rækkerne efter ændringen og bekræft, at der er 18 dashboards via rollen.
