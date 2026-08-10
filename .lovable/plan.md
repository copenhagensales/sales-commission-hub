# Laura: rekruttering-rolle som løsning?

Kort svar: **delvist — men det løser ikke begivenheder, og det giver hende markant mere adgang end hun har brug for.**

## Hvad rollebyttet faktisk løser

| Ønske | Med rollen `rekruttering` |
|---|---|
| Kommende opstarter | Ja — `menu_section_personale` + `menu_employees` er åbne for rekruttering |
| Ansættelser | Ja — `menu_upcoming_hires` view + edit |
| Svare på beskeder | Ja — `menu_messages` edit + alle `tab_messages_*`, og RLS på `messages` tillader `is_rekruttering()` |
| Oprette begivenheder | **Nej** — policyen på `company_events` kræver `is_teamleder_or_above()`; rekruttering er ikke leder, så gem fejler fortsat |

## Bivirkninger hun ikke har bedt om

Rekruttering har (som SOME ikke har) view/edit på bl.a.:
- Personale: medarbejderkort, stillinger, **rettighedsfanen**, dialer-mapping, deaktivering af medarbejdere
- Teams, vagtoversigt, tidsregistrering, fravær, lukkevagter
- Alle salgsdashboards + Salgsoversigt (alle) med edit, leaderboard, TDC-opsummering
- Softphone ind/udgående, medarbejder-SMS

Og hun **mister** edit på `menu_some` (SOME-sektionen), `menu_h2h`, `menu_my_goals`, `menu_my_feedback`, spil-sektionen.

## Tre veje

**A. Rollebyt til `rekruttering`** — hurtigst, ingen kodeændring. Men Laura får adgang til personaledata og rettighedsstyring, og begivenheder virker stadig ikke. Kan delvist afbødes med individuelle deny-overrides i `user_menu_permissions` (samme mønster Oscar bruger) — men det bliver lappearbejde.

**B. Udvid SOME-rollen (anbefalet)**
1. Rettighedsfanen for `some`: `menu_section_personale` view = ja, `menu_upcoming_hires` edit = ja, `menu_messages` edit = ja, `tab_messages_*` view = ja, `menu_upcoming_starts` visibility = alle.
2. Ny permission-nøgle `action_manage_company_events` + policy på `company_events` der bruger den eksisterende `has_edit_permission()` i stedet for `is_manager_or_above()`. Så styres begivenheder fremover fra rettighedsfanen for alle roller.
3. Samme mønster på `messages` hvis vi vil have SOME til at skrive uden at hardkode `is_some()`.

Punkt 2-3 er **rød zone** (RLS/auth) og kræver migration + godkendelse.

**C. Kun det grønne nu** — lav punkt 1 i B med det samme, så hun får opstarter, ansættelser og læsning af beskeder. Begivenheder + gem-beskeder venter til RLS-ændringen.

## Teknisk

- Rolle bestemmes af stillingens `system_role_key` i `job_positions` (SOME → `some`)
- Diff verificeret mod `role_page_permissions` for `role_key in ('some','rekruttering')`
- Policies: `company_events` ALL → `is_manager_or_above()`; `messages` ALL → `is_owner() OR is_rekruttering()`
- `has_edit_permission()` findes allerede som SECURITY DEFINER-funktion
