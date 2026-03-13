

## Tilføj og fjern diæt på en dag — samme mønster som bil og medarbejder

### Ændringer i `BookingsContent.tsx`

1. **Ny `addDietToDayMutation`** — inserter i `booking_diet` med `booking_id` og `date`. Invaliderer `vagt-booking-diets`.

2. **Ny `removeDietFromDayMutation`** — sletter fra `booking_diet` med match på `booking_id` og `date`. Invaliderer `vagt-booking-diets`.

3. **Tilføj diæt-knap i `DayQuickAddButtons`** — en tredje hover-knap med `Utensils`-ikon. Hvis dagen allerede har diæt, vises den ikke (diæt er binær toggle — enten har dagen diæt eller ej, ingen popover nødvendig). Klik tilføjer diæt direkte.

4. **Fjern-knap på Diæt-badge** — tilføj en lille X-knap på den eksisterende Diæt-badge (begge grids), der kalder `removeDietFromDayMutation`. Vises kun ved hover og kun når `canEditFmBookings`.

5. **Logik i DayQuickAddButtons**: Tjek `dietByBookingDate` for at afgøre om tilføj-knappen vises (kun hvis der IKKE allerede er diæt på den dag).

### Mønster
```text
┌─────────┐
│  Man  X  │
│  Anders  │
│  🚗 Bil1 x│
│  🍴 Diæt x│  ← X fjerner diæt
│ [+👤][+🚗][+🍴] │  ← hover, +🍴 kun hvis ingen diæt
└─────────┘
```

### Omfang
- Kun `BookingsContent.tsx`
- Ingen nye filer eller database-ændringer
- `dietByBookingDate` skal passes som prop til `DayQuickAddButtons`

