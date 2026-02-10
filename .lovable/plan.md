
# Komplet Oprydning: FM + Systemdækkende Problemer

## Analyse-resultat

Ud over de 3 FM-menupunkter der skal slettes, fandt analysen foelgende problemer i resten af systemet:

---

## Problem 1: FM - Dashboard, Vagtplan FM, Min uge (som aftalt)

Tre sidebar-menupunkter peger paa ruter der ikke eksisterer (`/vagt-flow/vagtplan-fm` og `/vagt-flow/min-uge`) eller duplikerer funktionalitet (`/vagt-flow/fieldmarketing-dashboard`).

**Slet fra:**
- `AppSidebar.tsx`: Fjern de 3 sidebar-entries (linje 1179-1205) + fjern fra `showFieldmarketingMenu` (linje 444)
- `usePositionPermissions.ts`: Fjern `canViewFmDashboard`, `canEditFmDashboard`, `canViewFmVagtplanFm`, `canEditFmVagtplanFm`, `canViewFmMyWeek`
- `permissionKeys.ts`: Fjern `menu_fm_dashboard`, `menu_fm_my_week`, `menu_fm_vagtplan_fm`, `tab_fm_eesy`, `tab_fm_yousee`
- `permissions.ts`: Fjern `menu_fm_my_week` fra PERMISSION_CATEGORIES
- `routes/config.tsx`: Fjern `/vagt-flow/fieldmarketing-dashboard` ruten + `VagtFieldmarketingDashboard` import
- Database: Slet raekker for de 5 keys

---

## Problem 2: `menu_cancellations` mangler i permissionKeys.ts

Permission key `menu_cancellations` bruges i:
- `routes/config.tsx` (linje 367): rute med `positionPermission: "menu_cancellations"`
- `AppSidebar.tsx` (linje 84): `canViewCancellations = p.canView("menu_cancellations")`

Men den eksisterer IKKE i `permissionKeys.ts` (den centrale kilde). Det betyder:
- Den dukker ikke op i Permission Editor
- Auto-seeding opretter den ikke for nye roller
- Kun ejere kan se den (owner-override)

**Fix**: Tilfoej `menu_cancellations` til `permissionKeys.ts` under `menu_section_salary`, og tilfoej den til `permissions.ts` PERMISSION_CATEGORIES under Loen-sektionen. Tilfoej ogsaa `canViewCancellations` og `canEditCancellations` som egentlige permission helpers i `usePositionPermissions.ts` i stedet for den loese `p.canView()` reference i sidebaren.

---

## Problem 3: Okonomi-menu mangler permissions-check i sidebaren

Okonomi-sektionen i sidebaren (linje 1597-1649) renderer ALLE menupunkter uden permissions-check. Alle 5 NavLinks vises altid naar `showEconomicMenu` er true, uden at tjekke individuelle rettigheder som `menu_economic_dashboard`, `menu_economic_expenses` osv.

**Fix**: Wrap hvert NavLink i et permissions-check:
- Overblik: `p.canView("menu_economic_dashboard")`
- Udgifter: `p.canView("menu_economic_expenses")`
- Budget 2026: `p.canView("menu_economic_budget")`
- Mapping: `p.canView("menu_economic_mapping")`
- Import: `p.canView("menu_economic_upload")`

Tilfoej ogsaa de tilsvarende `canViewEconomic*` helpers til `usePositionPermissions.ts`.

---

## Problem 4: Live Stats bruger forkert permission

Live Stats i sidebaren (linje 1667) vises naar `p.canViewSettings` er true, men den burde bruge sin egen permission `menu_live_stats`. Lige nu kan alle med Settings-adgang se Live Stats, selvom det er en separat funktion.

**Fix**: AEndr betingelsen til `p.canViewLiveStats` (eller `p.canView("menu_live_stats")`), og tilfoej `canViewLiveStats` som helper i `usePositionPermissions.ts`.

---

## Problem 5: Beskeder i Mit Hjem bruger forkert permission

I sidebaren (linje 552) vises "Beskeder" under Mit Hjem med `p.canViewMessages`, men `canViewMessages` mapper til `menu_messages` (rekruttering-beskeder). Den korrekte permission er `menu_messages_personal`.

Der FINDES allerede et helper i `usePositionPermissions.ts`: `canViewMessagesPersonal` eksisterer IKKE - men burde oprettes for `menu_messages_personal`. Lige nu bruger sidebaren den forkerte check.

**Fix**: Tilfoej `canViewMessagesPersonal` helper i `usePositionPermissions.ts` og brug den i sidebaren i stedet for `canViewMessages`.

---

## Samlet Filoversigt

| Fil | AEndringer |
|---|---|
| `src/config/permissionKeys.ts` | Fjern 5 FM-keys, tilfoej `menu_cancellations` |
| `src/config/permissions.ts` | Fjern `menu_fm_my_week`, tilfoej Annulleringer |
| `src/hooks/usePositionPermissions.ts` | Fjern 5 FM-helpers, tilfoej cancellations/economic/live-stats/messages-personal helpers |
| `src/components/layout/AppSidebar.tsx` | Fjern 3 FM-entries, fix okonomi permissions, fix Live Stats, fix Beskeder |
| `src/routes/config.tsx` | Fjern fieldmarketing-dashboard rute + import |
| Database | Slet 5 FM permission-raekker |

## Prioritering

1. **Kritisk** - FM oprydning (Problem 1): Fjerner doede links
2. **Hoej** - Beskeder forkert permission (Problem 5): Kan give forkert adgang
3. **Hoej** - menu_cancellations mangler (Problem 2): Usynlig i Permission Editor
4. **Medium** - Okonomi mangler checks (Problem 3): Viser alt naar sektionen er synlig
5. **Lav** - Live Stats forkert check (Problem 4): Mindre afvigelse
