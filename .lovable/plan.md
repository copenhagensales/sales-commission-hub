
## Forbedring af "Brugerdefineret" periodevalg

### Problem
Naar man klikker "Brugerdefineret..." i dropdown-menuen, lukker dropdown'en forst, og sa abner en separat kalender-popup via en `setTimeout`-hack. Det foeles usammenhaegende og kraever to trin.

### Losning
Erstat `DropdownMenu` + separat kalender med en enkelt `Popover` der viser **presets til venstre** og **kalender til hojre** i et samlet panel - praecis som `DashboardDateRangePicker` allerede gor andetsteds.

### Nyt flow
1. Klik pa knappen -> en popover abner
2. Venstre side: hurtigvalg (I dag, I gar, Denne uge, osv.)
3. Hojre side: kalender i range-mode til brugerdefineret valg
4. Valg af preset eller faerdiggorelse af dato-range lukker popoveren automatisk

### Tekniske detaljer

**Fil: `src/components/dashboard/DashboardPeriodSelector.tsx`**

- Fjern import af `DropdownMenu`, `DropdownMenuContent`, `DropdownMenuItem`, `DropdownMenuSeparator`, `DropdownMenuTrigger`
- Tilfoej import af `Popover`, `PopoverContent`, `PopoverTrigger` fra `@/components/ui/popover`
- Fjern `calendarOpen` state (ikke laengere noedvendig)
- Tilfoej `open`/`setOpen` state til Popover
- Erstat hele JSX-blokken (linje 175-234) med:
  - `Popover` med `open`/`onOpenChange`
  - `PopoverTrigger` med den eksisterende knap
  - `PopoverContent` med `flex`-layout:
    - Venstre: `div` med `border-r` og preset-knapper (`Button variant="ghost"`) der kalder `handlePresetSelect` + lukker popover
    - Hojre: `Calendar mode="range"` med `numberOfMonths={2}`, `locale={da}`, der lukker popover nar begge datoer er valgt
- Al eksisterende logik for periodeberegning, `getDefaultPeriod`, caching-funktioner og typer forbliver uaendret
- Fjern `ChevronDown` import (erstattes af ren kalender-ikon stil)
