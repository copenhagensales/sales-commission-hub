# Per-bruger rettigheder: afgræns "TDC Erhverv - ret salg"

Målet: kun ejere, Rasmus Emil Hansen, Johannes Hedebrink og Oliver Gonsalves må se og rette på fanen. Adgangen skal styres i databasen og fra rettighedsmodulet — ikke i koden.

## Nuværende tilstand (verificeret)

- `menu_reports_tdc_edit_sales` er slået til for rollerne `ejer`, `teamleder`, `assisterendetm`, `salgskonsulent_tdc_support` (`role_page_permissions`). Det giver 13 aktive brugere adgang, bl.a. Filip, Jonas, Karl, Sejer og Sebastian, som ikke skal have den.
- Permission-motoren læser udelukkende rolle-niveau: `usePositionPermissions.ts:284-310` henter `role_page_permissions` for brugerens rolle. Der findes ingen per-bruger lag i motoren i dag (den gamle `user_menu_permissions`-tabel refereres ikke længere fra `src/`).
- Derfor har tidligere allowlist-forsøg været skrøbelige: de sad kun i UI-laget og ikke i det lag, som både menu, route-guard og RLS spørger.

## Løsning: nyt per-bruger lag i rettighedssystemet

Vi bygger per-bruger rettigheder som en generel funktion, så det kan bruges til alle fremtidige undtagelser — ikke kun denne fane.

1. **Ny tabel `user_page_permissions`** med samme form som `role_page_permissions`: bruger, `permission_key`, `can_view`, `can_edit` samt `mode` = `grant` eller `deny`. Kun ejere kan oprette/ændre rækker; enhver bruger kan læse sine egne.
2. **Resolutionsrækkefølge** (én sandhed, både i frontend og database): `deny` for brugeren slår alt → `grant` for brugeren giver adgang → ellers rolle-rettigheden → ejer-bypass som i dag.
3. **Frontend**: `usePositionPermissions` henter også brugerens egne rækker og fletter dem ind i `permissions`-objektet efter ovenstående rækkefølge. Alt der bygger på `canView`/`canEdit` — menu, route-guards, sider — virker derefter automatisk, uden ændringer pr. side.
4. **Database/RLS**: den eksisterende funktion `has_page_permission` udvides med samme resolutionsrækkefølge, og `can_edit_tdc_erhverv_sales` bygges oven på den. RLS-politikkerne på `sales`/`sale_items` ændres ikke og er fortsat afgrænset til klienten TDC Erhverv.
5. **UI til styring**: i Rettigheder (Medarbejdere → Rettigheder) tilføjes en visning pr. medarbejder, hvor en ejer kan give eller fjerne en enkelt rettighed for den person. Så kan I selv styre undtagelser fremover uden kodeændringer.
6. **Konkret opsætning for fanen**: rolle-rettigheden fjernes for `teamleder` og `assisterendetm`; Rasmus og Johannes får `grant` på `menu_reports_tdc_edit_sales` personligt. `ejer` og `salgskonsulent_tdc_support` (Oliver) beholder rolle-adgangen.
7. **Verifikation**: adgangstjekket køres for Rasmus, Johannes, Oliver og en ejer (forventet `true`) samt Filip, Jonas, Karl, Sejer og Sebastian (forventet `false`), og selve siden tjekkes i preview.

## Teknisk

- Migration: `CREATE TABLE public.user_page_permissions (id, user_id, permission_key, can_view, can_edit, mode, created_at, updated_at, created_by)` + unik nøgle på (user_id, permission_key) + GRANT til `authenticated` og `service_role` + RLS (ejer full, egen række læsbar) + updated_at-trigger. Derefter `CREATE OR REPLACE FUNCTION public.has_page_permission` og `public.can_edit_tdc_erhverv_sales` med den nye resolutionsrækkefølge (SECURITY DEFINER, `search_path = public`).
- Data: fjern `menu_reports_tdc_edit_sales` for `teamleder` og `assisterendetm` i `role_page_permissions`; indsæt `grant`-rækker for Rasmus (rh@) og Johannes (joh@).
- Kode: `src/hooks/usePositionPermissions.ts` (flet per-bruger rækker ind efter rolle-hentningen), nyt UI i `src/components/employees/permissions/` til per-bruger undtagelser. Ingen ændringer i `useTdcErhvervSales.ts`, `AppSidebar.tsx` eller `src/routes/config.tsx` — de bygger allerede på `canView`.
- Zone: rød (auth/RLS + rettigheder). Ingen ændringer i pricing, provision eller løn.
- Cache: permission-cachen nulstilles ved ændring, så en bruger ser effekten ved næste indlæsning.
