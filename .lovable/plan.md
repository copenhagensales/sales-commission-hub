

## Fix: Vis korrekt antal medarbejdere (unikke, ikke rækker)

### Problem
`booking_assignment` har en række per medarbejder per dag. Koden tæller alle rækker, så en booking med 2 medarbejdere over 5 dage viser "10 medarbejdere" i stedet for "2 medarbejdere".

### Løsning
Ændr linje 101 i `src/pages/vagt-flow/HotelsContent.tsx` til at tælle unikke `employee_id` værdier:

```typescript
const uniqueStaff = new Set(
  (booking.booking_assignment || []).map((a: any) => a.employee_id)
);
const staffCount = uniqueStaff.size || booking.expected_staff_count || 0;
```

### Omfang
En enkelt fil, to linjer.

