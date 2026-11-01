# TDC Erhverv Fiber: admin som popup + ejere/admins kan taste

## Hvad ændres
1. **Admin-boksen bliver en popup.** Øverst på fanen kommer en knap »Administrér sælgere« (kun for ejere og admins). Den åbner listen i et vindue (skuffe fra bunden på telefon). Indholdet er det samme som i dag: tilføj og fjern sælgere.
2. **Ejere og admins kan registrere fibersalg.** Rasmus og Johannes kan allerede taste i databasen, fordi de står på listen som admin. Formularen vises nu også for ejere, selvom de ikke står på listen.

## Teknisk
- Database (migration): `tdc_fiber_opret_salg` og indsætningsreglen på `sales` tillader også `is_owner(auth.uid())` ud over adgangslisten. Funktionen forbliver SECURITY INVOKER. Ingen andre regler ændres.
- `src/pages/TdcErhvervFiberPladsholder.tsx`: `maaSaelge = rolle || isOwner`; admin-indhold flyttes ind i en `Dialog` (computer) / `BottomSheet` (telefon) fra de eksisterende byggeklodser; teksten »Du er ikke på listen …« vises ikke længere for ejere.
- Kontrol: skærmbilleder ved 360/393/430 px og på computer, med popup åben og lukket.
