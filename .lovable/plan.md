
## Vis tidligere markeder og tillad bagudrettet medarbejdertilfoejelse

### Problem

Markeder-fanen henter kun fremtidige bookinger (linje 77: `.gte("start_date", format(today, "yyyy-MM-dd"))`). Tidligere afviklede markeder er helt usynlige, og man kan derfor ikke tilfoeje medarbejdere bagudrettet.

### Loesning

Udvid foerspoergslen til ogsaa at hente markeder op til 6 maaneder tilbage, og vis dem i en separat sektion i bunden med dæmpet styling saa de ikke fylder for meget.

### Teknisk plan

**Fil:** `src/pages/vagt-flow/MarketsContent.tsx`

**Aendring 1** -- Udvid dato-filteret i foerspoergslen (linje 63-79):

Erstat `today` som startdato med en dato 6 maaneder tilbage:

```typescript
const sixMonthsAgo = addMonths(today, -6);
// ...
.gte("start_date", format(sixMonthsAgo, "yyyy-MM-dd"))
```

**Aendring 2** -- Opdel bookinger i "kommende" og "tidligere" (i useMemo-logikken):

Tilfoej en ny `useMemo` der splitter `filtered` i to lister:
- `upcomingBookings`: bookinger med `start_date >= today`
- `pastBookings`: bookinger med `start_date < today`

Behold den eksisterende `groupedByMonth` logik for kommende bookinger, og tilfoej en tilsvarende `pastGroupedByMonth` for tidligere.

**Aendring 3** -- Vis tidligere markeder i bunden af siden:

Efter de eksisterende maaneds-sektioner, tilfoej en ny sektion med:
- En overskrift "Tidligere markeder" med dæmpet styling
- Samme collapsible maaneds-gruppering, men med `opacity-70` og en lidt anderledes baggrund saa de visuelt adskiller sig
- Sektionen starter lukket (collapsed) saa den ikke fylder

**Aendring 4** -- Opdater event-tælleren (linje 279-281):

Badge skal vise antal for baade kommende og tidligere, fx `"44 kommende · 3 tidligere"`.

### Resultat

- Tidligere markeder vises i bunden med dæmpet styling
- Man kan klikke paa et tidligere marked og aabne EditBookingDialog
- Man kan tilfoeje medarbejdere bagudrettet via den eksisterende dialog (ingen ændringer nødvendige der)
- Kalenderen viser ogsaa de tidligere markeder

### Filer der aendres

| Fil | Aendring |
|---|---|
| `src/pages/vagt-flow/MarketsContent.tsx` | Udvid dato-filter, split i kommende/tidligere, vis tidligere i bunden |
