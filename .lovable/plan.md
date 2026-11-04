# Fane "Biler" under Fieldmarketing → Booking

## Hvad du får
En ny fane **Biler** sidst i rækken under Fieldmarketing → Booking (efter Tjekliste), da den sjældent bruges. Her kan man:
- se alle biler (aktive og udgåede) med navn, nummerplade og note
- oprette en ny bil
- rette navn/nummerplade/note
- slå en bil fra (udgået) eller til igen

Biler slettes aldrig – en udgået bil slås kun fra, så gamle bookinger stadig viser den rigtige bil. Kun aktive biler vises i "Vælg bil".

## Hvem kan
- Fanen vises for dem, der allerede kan se Bookinger (samme rettighed, ingen ny rettighed).
- Gemme/rette kræver, at man er FM-admin eller planlægger – det håndhæver databasen allerede i dag. Andre ser listen, men knapperne er skjult/afvises.

## Ikke ændret
Ingen databaseændringer, ingen nye rettigheder, ingen eksisterende biler eller bookinger ændres. "Vælg bil" virker som før.

## Teknisk
- Ny hook `src/hooks/useVehicles.ts` (React Query: liste, opret, ret, aktiv/inaktiv; `retry: 0` på mutationer; invaliderer bil-forespørgsler så "Vælg bil" opdateres).
- Ny `src/pages/vagt-flow/VehiclesContent.tsx` (lazy), tabel på desktop, kort på mobil, dialog/BottomSheet til opret/ret.
- `BookingManagement.tsx`: tilføj `{ value: "biler", label: "Biler", icon: Car, permissionKey: "tab_fm_bookings" }` + TabsContent.
- Eksisterende RLS på `vehicle`: SELECT for indloggede, ALL for `is_vagt_admin_or_planner`. Knapper vises efter samme regel via eksisterende helper (læses før byg).
- Kontrol: build, preview på desktop og 360/393/430 px. Ingen testbil oprettes uden aftale.
