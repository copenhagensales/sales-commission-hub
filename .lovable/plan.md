

## Analyse: William Bornaks adgang til "Oplæring"-fanen

### Konklusion fra undersøgelsen

Der er **ingen adgangsbegrænsning** på "Oplæring"-fanen i koden. Fanen vises altid for alle, der kan åbne "Rediger booking"-dialogen.

**Fakta:**
- William Bornak er `fm_leder` med `can_view: true` + `can_edit: true` for alle FM-bookings
- EditBookingDialog viser altid alle 6 faner (Booking, Medarbejdere, Biler, Diæt, Oplæring, Hotel) — ingen permission-check per fane
- RLS på `booking_diet`-tabellen (hvor oplæringsbonusser gemmes) er åben for alle autentificerede brugere
- Ingen kode i dialogen tjekker rolle eller position for at skjule faner

### Mulige forklaringer

1. **Browser-cache / stale version** — William ser en ældre version uden fanen
2. **Forveksling med en anden side** — fanen eksisterer kun inde i "Rediger booking"-dialogen, ikke som en selvstændig fane i BookingManagement
3. **Fanen er der, men indholdet er tomt** — hvis bookingen ingen tildelte medarbejdere har, viser fanen kun "Tilføj først medarbejdere"

### Anbefalet plan: Tilføj permission-check til Oplæring-fanen

Hvis du vil styre adgangen granulært:

**Fil: `src/config/permissionKeys.ts`**
- Tilføj ny permission-nøgle: `tab_fm_training` med label "FM Oplæring"

**Fil: `src/config/permissionGroups.ts`**
- Tilføj `tab_fm_training` som child under `menu_fm_booking`

**Fil: `src/components/vagt-flow/EditBookingDialog.tsx`**
- Importér `usePermissions` 
- Tilføj `canView("tab_fm_training")` check
- Kun vis "Oplæring" TabsTrigger og TabsContent hvis brugeren har rettigheden
- Juster `grid-cols-6` dynamisk baseret på antal synlige faner

**Database migration**
- Indsæt `tab_fm_training` rettigheden for alle relevante roller (inkl. `fm_leder` med `can_view: true`)

### Tekniske detaljer

```text
EditBookingDialog.tsx ændringer:
1. Import usePermissions hook
2. const { canView } = usePermissions()
3. const showTrainingTab = canView("tab_fm_training")
4. Conditional render af TabsTrigger + TabsContent
5. Dynamic grid-cols baseret på antal synlige tabs
```

Totalt berørte filer: 4 (permissionKeys.ts, permissionGroups.ts, EditBookingDialog.tsx, migration SQL)

