# Tryg - Ret salg: markér flere og kopiér samlet

## Hvad der bygges

1. Ny markeringskolonne på hver salgslinje, placeret mellem "Kopiér" og "Slet" i handlingskolonnen.
2. Ny knap "Kopiér markerede" i kortets header, til venstre for handlinger/datovælgeren-rækken. Den er deaktiveret, når intet er markeret, og viser antallet, fx "Kopiér markerede (3)".
3. Klik kopierer skabelonteksten én gang, hvor `[Telefonnummer]` erstattes af alle markerede numre — ét nummer pr. linje.
4. Toast "Tekst kopieret" ved succes. Markeringer nulstilles ved skift af dag og efter sletning af en markeret linje.
5. Linjer uden telefonnummer kan ikke markeres (checkbox deaktiveret), da de intet ville bidrage med.

## Teknisk

- Kun `src/pages/reports/TrygEditSales.tsx` ændres.
- Ny state `selectedIds: Set<string>` baseret på `saleItemId`; toggle pr. række.
- Checkbox fra `@/components/ui/checkbox`.
- Kopiering genbruger den gemte skabelon fra `useReportTextTemplate` og samme `PHONE_PLACEHOLDER` som i dag — én kilde til teksten.
- `useEffect` nulstiller markeringer, når `day` ændres.

Ingen ændringer i hook, data, sletning, beregninger eller adgangskontrol — udelukkende visning.
