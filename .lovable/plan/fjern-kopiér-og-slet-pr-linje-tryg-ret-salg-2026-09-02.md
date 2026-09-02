# Fjern "Kopiér" og "Slet" pr. linje (Tryg - Ret salg)

## Hvad ændres
I handlingskolonnen på hver salgslinje fjernes:
- "Kopiér"-knappen (kopierede annulleringstekst for det enkelte nummer)
- "Slet"-knappen (åbnede bekræftelsesdialogen for sletning)

Tilbage på linjen: "Afvis" (rød), "Godkendt" (grøn) og markeringsfeltet (checkbox), så den øverste knap "Kopiér markerede" fortsat virker.

## Teknisk
Fil: `src/pages/reports/TrygEditSales.tsx`
- Fjern de to `Button`-blokke i handlings-cellen (linje ~438-448 og ~457-465).
- Behold `Checkbox` og bulk-kopieringsflowet.
- Behold slette-dialogen og `handleDelete` uændret i koden (ingen trigger på linjeniveau længere), medmindre du vil have den ryddet helt væk.
- Reducér kolonnebredden fra `w-[22rem]` til noget mindre (fx `w-64`) i både `TableHead` og `TableCell`.
- Fjern ubrugte ikon-imports (`Copy`, `Trash2`) hvis de ikke bruges andre steder i filen.

## Åbent spørgsmål
Skal slettefunktionen fjernes helt (inkl. dialog og hook-kald), eller blot skjules på linjeniveau? Planen som skrevet skjuler kun knappen.
