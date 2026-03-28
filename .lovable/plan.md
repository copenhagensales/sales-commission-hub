

## Plan: Hotelfane i Faktureringsrapport

### Hvad der bygges

En ny fane "Hoteller" i `/vagt-flow/billing` der viser alle hotelovernatninger samlet som én leverandør, med månedsvælger og overblik over udgifter.

### Ændringer

**1. Ny komponent: `src/components/billing/HotelExpensesTab.tsx`**

- Månedsvælger (samme stil som BillingOverviewTab)
- Henter `booking_hotel` med tilhørende `hotel` og `booking` (inkl. lokation) for valgt måned (baseret på check_in dato)
- KPI-kort: Samlet udgift, antal overnatninger, antal bookinger
- Tabel med kolonner: Booking (lokation + periode), Hotel, Check-in, Check-out, Dage, Pris, Status
- Total-række nederst

**2. Opdater `src/pages/vagt-flow/Billing.tsx`**

- Import `HotelExpensesTab`
- Tilføj fane "Hoteller" med Hotel-ikon i TabsList

### Filer

| Fil | Handling |
|-----|---------|
| `src/components/billing/HotelExpensesTab.tsx` | **Ny** — hotelovernatninger pr. måned |
| `src/pages/vagt-flow/Billing.tsx` | Tilføj fane |

### Teknisk detalje

Query henter `booking_hotel` med join til `hotel` og `booking(location:location_id(name, address_city))`, filtreret på `check_in` inden for valgt måned. Bruger eksisterende `(supabase as any)` pattern fra `useBookingHotels`.

