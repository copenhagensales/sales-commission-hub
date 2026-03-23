

# Tilføj Hotel-fane i Rediger Booking dialogen

## Hvad der bygges
En ny "Hotel" fane i `EditBookingDialog` der viser det tilknyttede hotel (hvis der er et) med mulighed for at redigere pris, status, bekræftelsesnummer — eller tildele et nyt hotel direkte fra booking-dialogen.

## Ændringer

### 1. `src/components/vagt-flow/EditBookingDialog.tsx`
- Udvid TabsList fra `grid-cols-4` til `grid-cols-5`
- Tilføj ny `TabsTrigger` for "Hotel" med `Building2`-ikon
- Tilføj ny `TabsContent value="hotel"` der:
  - Henter `booking_hotel` for den aktuelle booking via `useBookingHotels([booking.id])`
  - **Hvis hotel er tildelt**: Viser hotelnavnm, pris pr. nat (redigerbar), status, bekræftelsesnummer, noter — med gem-knap
  - **Hvis intet hotel**: Viser knap "Tildel hotel" der åbner `AssignHotelDialog`
- Importér `useBookingHotels`, `useUpdateBookingHotel` fra `useBookingHotels` hook
- Importér `AssignHotelDialog` til sub-dialog åbning

### 2. Ingen andre filer ændres
Alt genbrug eksisterende hooks og komponenter.

| Fil | Ændring |
|-----|---------|
| `src/components/vagt-flow/EditBookingDialog.tsx` | Ny Hotel-fane med visning/redigering af hoteltildeling |

