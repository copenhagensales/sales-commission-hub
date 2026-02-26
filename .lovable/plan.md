

## Flyt hotel-tag ned på de enkelte dage

### Hvad ændres
Hotel-badgen flyttes fra booking-headeren ned i dag-gitteret, så den vises pr. dag ligesom bil- og diæt-badges. Badgen vises kun på de dage der falder inden for hotellets check-in og check-out datoer.

### Teknisk plan

**Fil: `src/pages/vagt-flow/BookingsContent.tsx`**

1. **Fjern hotel-badge fra headeren** (linje 845-850) -- den nuværende badge under booking-titlen slettes.

2. **Udvid `hotelMap`** til at inkludere `checkIn` og `checkOut` datoer (fra `booking_hotel.check_in` og `booking_hotel.check_out`), så vi kan afgore hvilke dage hotellet daekker.

3. **Tilføj hotel-badge i dag-gitteret** (efter diæt-badgen, ca. linje 923): For hver dag tjekkes om datoen falder inden for hotellets check-in/check-out interval. Hvis ja, vises en blå badge med hotel-ikon og hotelnavn -- samme stil og størrelse som bil- og diæt-badges:

```text
  Man
  23/2
  Anders
  [Bil] Toyota
  [Diæt] Diæt
  [Hotel] AIR BNB    <-- nyt, kun på relevante dage
```

Badge-stilen bliver `text-[9px]` med `bg-blue-100 text-blue-800 border-blue-300` for at matche bil (gul) og diæt (orange) mønsteret.

4. **Fallback**: Hvis check-in/check-out ikke er sat, vises hotel-badgen på alle bookede dage for den pågældende booking.

### Omfang
En enkelt fil ændres (`BookingsContent.tsx`), ingen database-ændringer.
