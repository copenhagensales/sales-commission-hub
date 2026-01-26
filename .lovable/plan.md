
# Implementering: Klikbar Marked-booking med EditBookingDialog

## Oversigt
Gør marked-kortene i MarketsContent klikbare så de åbner EditBookingDialog direkte - samme dialog som bruges i BookingsContent.

## Ændringer i `src/pages/vagt-flow/MarketsContent.tsx`

### 1. Nye imports (linje 1-47)
Tilføj:
```typescript
import { EditBookingDialog } from "@/components/vagt-flow/EditBookingDialog";
import { getWeekStartDate } from "@/lib/vagt-flow-date-utils";
```

### 2. Ny state til dialog (efter linje 56)
```typescript
const [editBookingDialogBooking, setEditBookingDialogBooking] = useState<any>(null);
```

### 3. Query til Fieldmarketing medarbejdere (efter fieldmarketingClients query)
```typescript
const { data: employees = [] } = useQuery({
  queryKey: ["vagt-employees-for-markets-fieldmarketing"],
  queryFn: async () => {
    const { data: teamData } = await supabase
      .from("teams")
      .select("id, name")
      .ilike("name", "Fieldmarketing")
      .maybeSingle();

    if (!teamData) return [];

    const { data } = await supabase
      .from("team_members")
      .select(`employee_id, employee:employee_id(id, first_name, last_name, is_active)`)
      .eq("team_id", teamData.id);

    return (data || [])
      .filter((tm: any) => tm.employee?.is_active)
      .map((tm: any) => ({
        id: tm.employee.id,
        full_name: `${tm.employee.first_name} ${tm.employee.last_name}`,
        team: teamData.name,
      }));
  },
});
```

### 4. Query til køretøjer
```typescript
const { data: vehicles = [] } = useQuery({
  queryKey: ["vagt-vehicles-for-markets"],
  queryFn: async () => {
    const { data } = await supabase
      .from("vehicle")
      .select("id, name, license_plate")
      .eq("is_active", true)
      .order("name");
    return data || [];
  },
});
```

### 5. Bulk assign mutation (til tilføjelse af medarbejdere)
```typescript
const bulkAssignMutation = useMutation({
  mutationFn: async (assignments: { bookingId: string; employeeId: string; dates: string[] }[]) => {
    const inserts = assignments.flatMap(a => 
      a.dates.map(date => ({
        booking_id: a.bookingId,
        employee_id: a.employeeId,
        date,
        start_time: "09:00",
        end_time: "17:00",
      }))
    );
    const { data, error } = await supabase.from("booking_assignment").insert(inserts).select();
    if (error) throw error;
    return data;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings"] });
    toast({ title: "Medarbejdere tilføjet" });
  },
});
```

### 6. Ændr onClick på booking-kortet (linje 315)
Fra:
```typescript
onClick={() => navigate(`/vagt-flow/locations/${booking.location_id}?week=${booking.week_number}&year=${booking.year}`)}
```

Til:
```typescript
onClick={() => setEditBookingDialogBooking(booking)}
```

### 7. Opdater MarketCalendarWidget onClick (linje 253-257)
Fra:
```typescript
onBookingClick={(booking) => {
  if (booking.location?.id) {
    navigate(`/vagt-flow/locations/${booking.location.id}`);
  }
}}
```

Til:
```typescript
onBookingClick={(booking) => setEditBookingDialogBooking(booking)}
```

### 8. Tilføj EditBookingDialog komponenten (før lukkende `</div>`)
```typescript
{editBookingDialogBooking && (
  <EditBookingDialog
    open={!!editBookingDialogBooking}
    onOpenChange={(open) => !open && setEditBookingDialogBooking(null)}
    booking={editBookingDialogBooking}
    weekNumber={editBookingDialogBooking.week_number}
    year={editBookingDialogBooking.year}
    weekStart={getWeekStartDate(editBookingDialogBooking.year, editBookingDialogBooking.week_number)}
    employees={employees}
    vehicles={vehicles}
    onAddEmployeeAssignments={(assignments) => {
      bulkAssignMutation.mutate(
        assignments.map(a => ({
          bookingId: editBookingDialogBooking.id,
          employeeId: a.employeeId,
          dates: a.dates,
        }))
      );
    }}
    onAddVehicleAssignment={async (assignment) => {
      const inserts = assignment.dates.map(date => ({
        booking_id: editBookingDialogBooking.id,
        vehicle_id: assignment.vehicleId,
        date,
      }));
      const { error } = await supabase.from("booking_vehicle").insert(inserts);
      if (error) {
        toast({ title: "Fejl", description: error.message, variant: "destructive" });
      } else {
        queryClient.invalidateQueries({ queryKey: ["vagt-market-bookings"] });
        toast({ title: "Bil tilføjet" });
      }
    }}
  />
)}
```

## Brugerflow efter implementering

1. Bruger klikker på et marked-kort i "Markeder" fanen
2. EditBookingDialog åbnes med bookingens data
3. Bruger kan redigere:
   - Kunde og kampagne
   - Dagspris/samlet pris
   - Tilføje/fjerne medarbejdere
   - Tilføje/fjerne køretøjer
   - Tilføje diæt
4. Slet-knappen virker stadig separat (e.stopPropagation())
5. Kalender-widget klik åbner også dialogen

## Påvirkning

| Element | Påvirkning |
|---------|------------|
| Vagtplan (BookingsContent) | Ingen - separate queries |
| Billing | Ingen - læser samme data |
| Database | Ingen nye tabeller |
| Eksisterende funktionalitet | Bevares 100% |
