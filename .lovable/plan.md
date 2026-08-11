# Løsning B: SOME-rollen får Lauras fire ønsker

Ja — B dækker alle fire ønsker. Punkt 1 er ren rettighedsopsætning; punkt 2 og 3 kræver ændring af databasens sikkerhedsregler (rød zone), fordi selve gem-handlingen ellers stadig afvises.

| Ønske | Dækkes af | Resultat |
|---|---|---|
| Kommende opstarter | Trin 1 | Menupunktet bliver synligt (parent-nøglen åbnes) |
| Ansættelser | Trin 1 | Se + redigere |
| Oprette begivenheder | Trin 1 + 2 | Gem virker |
| Svare på beskeder | Trin 1 + 3 | Kan læse tråde og sende svar |

## Trin 1 — rettighedsflag for rollen `some`

Sættes i Personale → Medarbejdere → Rettigheder (eller som migration, hvis det skal dokumenteres):

- `menu_section_personale`: view = ja (ellers skjules Kommende opstarter)
- `menu_upcoming_starts`: visibility = Alle
- `menu_upcoming_hires`: edit = ja, visibility = Alle
- `menu_messages` + `menu_messages_recruitment`: edit = ja
- `tab_messages_all`, `tab_messages_sms`, `tab_messages_email`, `tab_messages_sent`: view = ja (`tab_messages_call` udelades)
- Ny nøgle `action_manage_company_events`: view + edit = ja **kun for `some`** (teamledere/ejere beholder adgang via den eksisterende leder-gren i policyen, så der tilføjes ingen rækker for dem)
- Ny nøgle `action_manage_candidate_messages`: view + edit = ja **kun for `some`** (rekruttering/ejer beholder adgang via de eksisterende grene)

Bemærk: `menu_section_personale` åbner sektionen Personale i sidebaren. Kun de underpunkter hun har view på vises — så hun får ikke medarbejderkort, teams eller rettighedsfanen.

## Ingen andre påvirkes — verificeret

- **Kun én aktiv medarbejder har rollen `some`:** Laura Brund Skov (stilling SOME). Alfred Rud står også med rollen, men er inaktiv — og `has_edit_permission()` kræver `is_active = true`, så han får intet.
- **Alle rettighedsændringer i trin 1 sker på `role_key = 'some'`** — ingen andre rolle-rækker røres.
- **Policy-ændringerne er rent tilføjende:** de eksisterende betingelser (`is_manager_or_above`, `is_owner`, `is_rekruttering`, egne employee-tråde) bevares uændret og får kun et `OR`-led. Ingen mister adgang.
- **Ingen individuelle overrides berøres** — Laura har ingen i dag.


## Trin 2 — begivenheder (RØD ZONE, migration)

`company_events` har i dag ALL-policyen `Managers can manage events` med `is_manager_or_above(auth.uid())`. Den erstattes af en policy der også accepterer permission-nøglen:

```
using (is_manager_or_above(auth.uid())
    or has_edit_permission(auth.uid(), 'action_manage_company_events'))
with check (samme udtryk)
```

`has_edit_permission()` findes allerede som SECURITY DEFINER og slår op i `role_page_permissions` via stillingens `system_role_key`. Ejere er indbygget i funktionen. `event_attendees` og `event_team_invitations` kræver ingen ændring — de er allerede åbne for authenticated.

## Trin 3 — beskeder (RØD ZONE, migration)

To tabeller er involveret:

- `messages`: ALL-policy `Rekruttering and owners can manage messages` (`is_owner OR is_rekruttering`) udvides med `has_edit_permission(auth.uid(), 'action_manage_candidate_messages')`.
- `communication_logs`: SELECT-policyen `Context-aware read access` tillader kun rekruttering/ejer at læse kandidat-tråde. Samme permission-tjek tilføjes på `context_type = 'candidate'`-grenen, ellers kan hun sende men ikke se historikken. INSERT er allerede åben for alle authenticated.

## Hvad B ikke gør

- Ændrer ikke `is_manager_or_above()` eller `is_rekruttering()` — eksisterende adgang er uberørt, vi tilføjer kun en ekstra vej ind.
- Giver ikke Laura personale-, team- eller lønadgang (i modsætning til at bytte hendes rolle til `rekruttering`).
- Rører ikke de øvrige hardkodede rolle-referencer i systemet; det er en separat oprydning.

## Verifikation efter implementering

1. Rollepreview som `some`: Kommende opstarter og Ansættelser vises i menuen.
2. Log ind som Laura (eller preview + faktisk test): opret en begivenhed → gem lykkes.
3. Åbn en kandidat-tråd under Beskeder → historik vises, svar kan sendes.
4. Kontroltest med rollen `medarbejder`: gem af begivenhed skal fortsat afvises.

## Teknisk

- Rolleopslag: stillingens `system_role_key` i `job_positions` (SOME → `some`)
- Nøgler registreres i `src/config/permissionKeys.ts` + rækker i `role_page_permissions`
- Sidebar-synlighed afhænger af parent-nøgle: `src/components/layout/AppSidebar.tsx`
- Event-gem: `src/pages/Home.tsx` insert i `company_events`
