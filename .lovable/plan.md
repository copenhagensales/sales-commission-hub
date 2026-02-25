

## Tilfoej bagudrettet funktionalitet for vagter og lokationer

### Identificerede problemer

1. **Uge-navigation i "Book uge" kan ikke skifte aar**: `handlePrevWeek` og `handleNextWeek` i `BookWeekContent.tsx` haandterer ikke aar-graenser. Uge 1 minus 1 giver uge 0, som er ugyldig. Det goer det umuligt at navigere til foregaaende aar.

2. **Ingen "Book alligevel"-knap for utilgaengelige lokationer i fortiden**: Lokationer der allerede har en booking i den valgte uge, eller har status "Sortlistet"/"Pause", vises under "Utilgaengelige" uden mulighed for at booke. For bagudrettede bookinger boer der vaere en "Book alligevel"-knap (som der allerede er for cooldown-lokationer).

3. **Opret lokation med startdato/status**: Naar man opretter en ny lokation kan man ikke angive en startdato eller saette status til "Aktiv" direkte, saa den er klar til at booke bagudrettet.

### Teknisk plan

#### 1. Fix aar-graense i uge-navigation (`BookWeekContent.tsx`)

Ret `handlePrevWeek` og `handleNextWeek` (linje 316-328) til at haandtere aarsskift:

```text
handlePrevWeek:
  Uge 1 -> Uge 52, aar - 1
  
handleNextWeek:
  Uge 52 -> Uge 1, aar + 1
```

#### 2. Tilfoej "Book alligevel"-knap for utilgaengelige lokationer (`BookWeekContent.tsx`)

I tabellen under "Utilgaengelige" (ca. linje 507-533), tilfoej en "Book alligevel"-knap med variant="outline" saa brugere kan oprette bagudrettede bookinger paa lokationer der allerede er booket i den uge.

#### 3. Tilfoej status-vaelger i "Opret ny lokation" (`LocationsContent.tsx`)

I dialogen for ny lokation (linje ~235), tilfoej en Select for status med valgmulighederne "Ny", "Aktiv", "Pause", "Sortlistet". Default forbliver "Ny", men brugeren kan saette "Aktiv" med det samme saa lokationen er klar til booking.

### Filer der aendres

| Fil | Aendring |
|---|---|
| `src/pages/vagt-flow/BookWeekContent.tsx` | Fix aar-rollover i handlePrevWeek/handleNextWeek + tilfoej Book-knap paa utilgaengelige |
| `src/pages/vagt-flow/LocationsContent.tsx` | Tilfoej status-vaelger i opret-dialog |

