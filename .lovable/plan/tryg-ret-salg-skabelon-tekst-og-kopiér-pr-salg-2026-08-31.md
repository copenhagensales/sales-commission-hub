# Tryg - Ret salg: skabelon-tekst og kopiér pr. salg

## Hvad der bygges

1. Ny knap "Skabelon" ved siden af datovælgeren i kortets header.
   - Klik åbner en boks (popover) med read-only tekst:

```text
Hej Tryg,

Vil i annullerer mødet på [Telefonnummer].
```

   - Teksten er ikke redigerbar (read-only textarea) og indeholder placeholderen statisk.

2. Ny handling på hver salgsrække: en kopiér-knap ved siden af "Slet".
   - Kopierer samme skabelontekst, hvor `[Telefonnummer]` erstattes med rækkens telefonnummer.
   - Toast "Tekst kopieret" ved succes. Knappen er deaktiveret, hvis rækken mangler telefonnummer.

## Teknisk

- Kun `src/pages/reports/TrygEditSales.tsx` ændres.
- Skabelonen defineres som konstant i filen: `TRYG_CANCEL_TEMPLATE` med `[Telefonnummer]` som placeholder, så både boksen og kopiér-knappen bruger samme tekst (én kilde).
- Popover fra `@/components/ui/popover` (allerede importeret), read-only `Textarea` fra `@/components/ui/textarea`.
- Kopi via `navigator.clipboard.writeText`, toast via `sonner` (allerede importeret).
- Handlinger-kolonnen udvides til at rumme to knapper; ingen ændring i colSpan eller kolonneantal.

Ingen ændringer i hook, data, sletning, beregninger eller adgangskontrol — udelukkende visning.
