# Rettigheder til SOME-rollen (Laura)

Laura sidder på stillingen **SOME** → rollen `some`. Tre af hendes fire ønsker kan ikke løses med rettighedsfanen alene: to af dem blokeres af RLS i databasen (rød zone).

## Hvad jeg har konstateret

| Ønske | Status i dag | Årsag |
|---|---|---|
| Kommende opstarter | `menu_upcoming_starts` = view: ja | Men `menu_section_personale` = view: **nej** → menupunktet vises ikke i sidebaren |
| Ansættelser | `menu_upcoming_hires` = view: ja, edit: nej | Sektionen Rekruttering er synlig, så hun kan se den — men ikke redigere |
| Oprette begivenheder | Dialogen findes, men gem fejler | RLS-policy `Managers can manage events` på `company_events` kræver `is_teamleder_or_above()`. SOME er ikke leder → INSERT afvises |
| Svare på beskeder | `menu_messages` = view, edit: nej. Alle `tab_messages_*` = nej | Desuden tillader RLS på `messages` kun ejer/rekruttering at skrive |

## Ændringer

### 1. Rettighedsfanen (grøn/gul — ingen DB-skema)
Sæt for rollen `some`:
- `menu_section_personale`: view = ja (gør Kommende opstarter synlig)
- `menu_upcoming_starts`: visibility = `all` (så hun ser alle opstarter, ikke kun egne)
- `menu_upcoming_hires`: edit = ja, visibility = `all` (hvis hun skal kunne rette, ikke kun se)
- `menu_messages`: edit = ja
- `tab_messages_all`, `tab_messages_sms`, `tab_messages_email`, `tab_messages_sent`: view = ja (`tab_messages_call` udelades, medmindre hun skal se opkald)

Dette kan gøres direkte i UI'et under Personale → Medarbejdere → Rettigheder, eller som migration hvis du vil have det dokumenteret.

### 2. Begivenheder — kræver RLS-ændring (RØD ZONE)
`company_events` skal kunne skrives af SOME. To muligheder:

- **A (anbefalet, permission-drevet):** ny policy der tillader INSERT/UPDATE/DELETE hvis brugeren har `can_edit` på en ny nøgle `action_manage_company_events` i `role_page_permissions` — via en SECURITY DEFINER-funktion `has_edit_permission()` (findes allerede i databasen). Så styres det fremover fra rettighedsfanen i stedet for hardkodede roller.
- **B (hurtig):** udvid policyen til også at tillade `is_some()`. Hardkoder rollen — i strid med princippet om DB-drevne rettigheder.

Samme valg gælder `event_attendees`/`event_team_invitations` (invitationer er i dag åbne for alle authenticated, så de er ikke et problem).

### 3. Svare på beskeder — kræver RLS-ændring (RØD ZONE)
`messages`-tabellen har kun policyen `Rekruttering and owners can manage messages`. For at SOME kan svare skal der samme mønster som ovenfor: ny nøgle (fx `action_reply_messages`) + policy via `has_edit_permission()`, eller udvidelse til `is_some()`.

Bemærk: `communication_logs` (SMS/mail-log) tillader allerede INSERT for alle authenticated, men læsning af kandidat-tråde kræver rekruttering/ejer — så hun vil kunne sende uden at se historikken, indtil læsepolicyen også udvides.

## Beslutninger jeg mangler fra dig

1. Skal ændringerne gælde **hele SOME-rollen** eller kun Laura personligt (individuel override i `user_menu_permissions`)?
2. Begivenheder + beskeder: løsning **A** (ny permission-nøgle, DB-drevet) eller **B** (hardkod `is_some`)?
3. Skal hun kunne **redigere** ansættelser og kommende opstarter, eller kun se dem?
4. Skal hun kunne læse kandidat-beskedtråde (kræver udvidelse af læsepolicyen på `communication_logs`)?

## Teknisk

- Rettighedsdata: `role_page_permissions` (role_key = `some`), nøgler defineret i `src/config/permissionKeys.ts`
- Sidebar-synlighed afhænger af parent-nøglen (`menu_section_personale`) — se `src/components/layout/AppSidebar.tsx`
- Route: `/upcoming-starts` → `menu_upcoming_starts` (`src/routes/config.tsx:215`)
- Event-gem: `src/pages/Home.tsx:346` insert i `company_events`
- Policies: `company_events` ALL → `is_manager_or_above()`; `messages` ALL → `is_owner() OR is_rekruttering()`
