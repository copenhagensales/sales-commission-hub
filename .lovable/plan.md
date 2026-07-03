## Problem

Checkboxen "Kan bookes på FM-vagter" på Thorbjørns profil er sat, men han dukker ikke op i dropdown'en når man redigerer en booking (screenshot: "Rediger booking → Medarbejder 1 (valgfri)").

Rod-årsag: EditBookingDialog i det weekly booking-view får sin `employees`-prop fra `src/pages/vagt-flow/BookingsContent.tsx:211-248`, som kun henter medlemmer af Fieldmarketing-teamet via `team_members`. Denne query blev IKKE opdateret i forrige runde — kun `Bookings.tsx` og `MarketsContent.tsx` fik `can_work_fm`-fallback.

## Fix (én fil, én query)

`src/pages/vagt-flow/BookingsContent.tsx` linje 210-248: erstat den nuværende team_members-only query med samme mønster som `MarketsContent.tsx` — kør to queries og merge dem:

1. Hent team_members på Fieldmarketing-teamet (som i dag).
2. Hent `employee_master_data` hvor `can_work_fm = true AND is_active = true`.
3. Merge til en unik liste (Map på `id` for at undgå dubletter).

Returnér samme shape som før: `{ id, full_name, team }`. For opt-in-medarbejdere sættes `team` til "Fieldmarketing" så resten af UI'en fungerer.

## Scope

- 1 fil, 1 query
- Ingen ændring af `EditBookingDialog`, pricing, løn eller rapport-logik
- Cache-key `vagt-employees-for-booking-fieldmarketing` genbruges (invalideres automatisk ved refresh)

## Efter deploy

Thorbjørn skulle dukke op i "Tilføj medarbejder"-dropdown i Rediger booking → Medarbejdere.
