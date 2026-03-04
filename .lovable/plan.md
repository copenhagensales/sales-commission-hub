

## Plan: Add "Teammål" page under "Mit Hjem"

### What we'll build
A new "Teammål" (Team Goals) page accessible from the "Mit Hjem" sidebar menu, placed after "Løn & Mål". Initially a placeholder page that can be filled with content later.

### Steps

1. **Add permission key** `menu_team_goals` in `src/config/permissionKeys.ts` under the MIT HJEM section.

2. **Add permission to config** in `src/config/permissions.ts` under the "menu_mit_hjem" group.

3. **Add permission mapping** in `src/hooks/usePositionPermissions.ts` — add `canViewTeamGoals: hasPermission("menu_team_goals")`.

4. **Create page component** `src/pages/TeamGoals.tsx` — simple placeholder page wrapped in `MainLayout` with a title "Teammål".

5. **Export lazy page** in `src/routes/pages.ts` — add `TeamGoals` lazy import.

6. **Add route** in `src/routes/config.tsx` — path `/team-goals`, permission `menu_team_goals`, under the personal menu routes.

7. **Add sidebar link** in `src/components/layout/AppSidebar.tsx` — add a NavLink to `/team-goals` after the "Løn & Mål" entry, gated by `p.canViewTeamGoals`, using the `Users` or `Target` icon.

8. **Add to PreviewSidebar** in `src/components/layout/PreviewSidebar.tsx` — add `menu_team_goals` entry to the personal menu items map.

9. **Add icon mapping** in `src/components/employees/PermissionsTab.tsx` for the new permission key.

