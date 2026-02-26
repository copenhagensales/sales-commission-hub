

## Fix: "På vagt" viser stadig folk i weekenden

### Problem
Weekend-tjekket blev kun tilføjet i `dayData`-beregningen (linje 196), men i renderingen (linje 284) beregnes "På vagt" separat som `totalEmployees - day.absent` -- uden weekend-tjek. Derfor vises stadig 21-23 medarbejdere på vagt lørdag/søndag.

### Løsning
Linje 284 i `CapacityPanel.tsx`: Tilføj samme weekend-tjek, så "På vagt" viser 0 i weekenden.

**Ændring:**
```typescript
// FØR (linje 284):
const available = totalEmployees - day.absent;

// EFTER:
const isWeekendDay = day.date.getDay() === 0 || day.date.getDay() === 6;
const available = isWeekendDay ? 0 : totalEmployees - day.absent;
```

En enkelt linje-ændring -- resten af panelet bruger allerede de korrekte `dayData`-værdier med weekend-tjek.
