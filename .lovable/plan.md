
# Plan: Visuel Optimering af Marked-Kalenderen

## Problemanalyse
Den nuværende kalender bruger små farvede prikker (1.5x1.5px) til at vise markeder på hver dag. Dette skaber følgende problemer:

1. **Svær at se på større skærme** - prikkerne er for små
2. **Ingen tælling synlig** - man kan ikke se hvor mange markeder der er på en dag
3. **Ingen teaminfo** - man skal hover for at se detaljer
4. **Max 3 prikker vises** - skjuler information hvis der er flere

---

## Løsningsforslag

### Ændring 1: Større og tydeligere dag-celler med antal-badge
- Forstør cellerne fra `h-8` til `h-10` eller `h-12`
- Vis et tal-badge i cellen når der er markeder (fx "2" for 2 markeder)
- Baggrundsfarve på cellen baseret på "værste" status (rød > gul > grøn)
- Mere synlig visuel effekt ved hover

### Ændring 2: Forbedret tooltip med mere information
- Vis bemandingsstatus per marked i tooltip (fx "3/4 bemandat")
- Vis landsdel/region
- Vis antal teams tildelt
- Gruppér efter status i tooltip for hurtigere overblik

### Ændring 3: Weekend-markering (Lø/Sø)
- Let baggrund på weekenddage for at adskille dem visuelt
- Gør det lettere at se markeder der falder på weekender

### Ændring 4: Multi-event indikator
- Når der er mere end 3 markeder samme dag, vis "+N" indikator
- Gradient eller stacking-effekt for at vise "densitet"

---

## Tekniske ændringer

### Fil: `src/components/vagt-flow/MarketCalendarWidget.tsx`

```text
1. Opdater dag-celle styling (linje ~121-153):
   - Større højde: h-10 i stedet for h-8
   - Baggrundsfarve baseret på "værste" booking status
   - Vis antal-badge (tal) i stedet for prikker når bookings > 1
   - Weekend-baggrund (lørdag/søndag med subtle bg)

2. Ny helper funktion: getWorstStatusColor()
   - Returnerer den mest kritiske farve for en dag
   - Prioritet: rød (afventer) > gul (delvis) > grøn (bemandat)

3. Forbedret tooltip (linje ~155-168):
   - Vis staffing status per booking
   - Vis region
   - Gruppér efter status
   - Tilføj "Klik for at se detaljer" hint

4. Multi-event visning:
   - Hvis 1 booking: Vis farvet prik
   - Hvis 2-3 bookings: Vis antal som tal med farvet baggrund
   - Hvis 4+ bookings: Vis tal + pulse animation for opmærksomhed
```

---

## Visuelt koncept

**Før:**
```text
┌────┐
│ 28 │  (lille rød prik i bunden)
└────┘
```

**Efter:**
```text
┌─────────┐
│   28    │  ← Rød baggrund hvis afventer
│   (3)   │  ← Antal markeder tydeligt vist
└─────────┘
```

For weekender:
```text
┌─────────┐
│Lø    28 │  ← Subtle grå baggrund
│   (2)   │  ← Gul hvis delvis bemandat
└─────────┘
```

---

## Implementeringsrækkefølge

1. **Opdater celle-dimensioner og layout**
   - Øg højde, tilføj flexbox struktur for bedre kontrol

2. **Tilføj baggrundsfarve-logik**
   - Ny `getWorstStatusColor()` funktion
   - Anvend som baggrund på cellen

3. **Erstat prikker med antal-badge**
   - Vis tallet centralt i cellen
   - Brug farvet cirkel/badge design

4. **Forbedre tooltip**
   - Tilføj staffing info
   - Tilføj region
   - Bedre formatering

5. **Weekend-styling**
   - Detect lørdag/søndag
   - Tilføj subtle baggrund

---

## Fordele

- **Øget synlighed**: Større elementer og tydeligere farver
- **Hurtigere overblik**: Antal synligt direkte uden hover
- **Bedre prioritering**: "Værste status" farve gør det let at se kritiske dage
- **Weekend-fokus**: Weekender (hvor markeder typisk er) skiller sig ud
- **Konsistent med eksisterende stil**: Bruger samme farvekoder og UI-mønstre
