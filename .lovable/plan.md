

## Fix: Vis 0 kapacitet i weekenden som standard

### Problem
Kapacitetspanelet viser alle FM-medarbejdere som "på vagt" alle 7 dage, inkl. lordag og sondag. FM-medarbejdere arbejder normalt kun mandag-fredag, sa weekenden bor vise 0 pa vagt (og dermed 0 kapacitet og 0 "mangler").

### Losning
Tilfoej et simpelt weekend-tjek i kapacitetsberegningen: hvis dagen er lordag (6) eller sondag (0), saet antal tilgaengelige medarbejdere til 0.

### Tekniske aendringer

**Fil: `src/components/vagt-flow/CapacityPanel.tsx`**

I `capacityByClient`-beregningen (linje 193-200), tilfoej et tjek for weekend:

```typescript
const dayData = weekDates.map((date) => {
  const dayOfWeek = date.getDay(); // 0 = Sunday, 6 = Saturday
  const isWeekendDay = dayOfWeek === 0 || dayOfWeek === 6;
  
  const absent = getAbsencesForDay(date);
  const available = isWeekendDay ? 0 : totalEmployees - absent;
  const capacity = Math.floor(available / 2);
  const booked = getBookingsForClientDay(client.id, date);
  const remaining = capacity - booked;
  
  return { date, capacity, booked, remaining, absent };
});
```

Dette betyder:
- **Mandag-fredag**: Beregning som nu (total minus fravaerende, divideret med 2)
- **Lordag-sondag**: 0 pa vagt, 0 kapacitet. Hvis der ER bookinger i weekenden, vises de stadig under "Booket lok." og "Mangler" bliver negativt (rod) for at signalere overbooking ift. standard kapacitet

### Fremtidig udvidelse
Hvis der pa et tidspunkt er medarbejdere med faste weekendvagter, kan logikken udvides til at tjekke individuelle vagtplaner per dag. Men for nu er "ingen weekend som standard" den korrekte antagelse.
