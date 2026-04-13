

## Tilføj Booking Flow til rettighedskortet

### Problem
`menu_booking_flow` bruges allerede i sidebar og `usePositionPermissions`, men nøglen er ikke defineret i `src/config/permissionKeys.ts` — den centrale kilde til alle rettigheder. Derfor vises den ikke i rettighedskortet (Permission Map), og rettigheden kan ikke fordeles til roller.

### Løsning
Tilføj `menu_booking_flow` til `PERMISSION_KEYS` i `src/config/permissionKeys.ts` under rekrutteringssektionen, sammen med de øvrige rekrutteringsnøgler.

### Fil: `src/config/permissionKeys.ts`
- Tilføj efter `menu_referrals` (linje ~193):
  ```
  menu_booking_flow: { label: 'Booking Flow', section: 'rekruttering', parent: 'menu_section_rekruttering' },
  ```
- Nøglen vil automatisk dukke op i rettighedskortet under "Rekruttering"-sektionen
- Auto-seeding opretter databaserækker, når en rolle vælges

### Ingen andre ændringer nødvendige
Sidebar og `usePositionPermissions` bruger allerede `menu_booking_flow` — de virker med det samme, når nøglen er registreret.

