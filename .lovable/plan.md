# Rekruttering får adgang til TV-link (se og oprette)

## Status i dag
- "TV Link"-knappen på dashboards vises kun for ejer og teamleder. Det er skrevet direkte i koden (`DashboardHeader.tsx:41`).
- Databasen tillader kun teamleder eller højere at se og oprette TV-links (politik på `tv_board_access`: `is_manager_or_above`).
- Rekruttering har derfor hverken knappen eller databaseadgang. Hvis kun knappen bliver åbnet, vil oprettelse fejle.

## Ændring
1. **Ny rettighed "TV-links (se/opret)"**, som kan slås til og fra pr. rolle under Rettigheder. Rollen Rekruttering får den med se og rediger. Ingen andre roller ændres.
2. **Knappen** vises for ejer, teamleder og alle med den nye rettighed. Den hardkodede rolle-tjekning erstattes med et rettighedstjek; ejer og teamleder bevarer adgang som i dag.
3. **Databasen**: der tilføjes en ekstra politik, så brugere med den nye rettighed kan se, oprette, ændre og slette TV-links. Den eksisterende politik for ledere røres ikke.

Rekruttering får ikke adgang til "TV Board Administration" eller dashboard-indstillinger.

## Tekniske detaljer (rød zone: auth/RLS + permissionKeys.ts)
- `src/config/permissionKeys.ts`: ny nøgle `action_tv_link_manage` (section dashboards).
- `DashboardHeader.tsx`: `canCreateTvLink = isOwner || isTeamleder || canEdit('action_tv_link_manage')` via eksisterende permission-hook.
- Migration: `create policy "TV link permission can manage" on tv_board_access for all to authenticated using (has_page_permission(auth.uid(),'action_tv_link_manage',true)) with check (samme)`.
- Data: upsert `role_page_permissions` (`rekruttering`, `action_tv_link_manage`, can_view=true, can_edit=true).
- Verifikation: forespørg politik og rettighedsrække; tjek build. Kræver Publish for knappen.
