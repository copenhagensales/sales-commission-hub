# Tryg - Ret salg: to visninger i toppen

## Hvad der ændres

Titlen "Kanvas-møder" bliver en knap, og ved siden af den kommer en ny knap med samme udseende: **"Alle tryg & alka salg"**. De to knapper fungerer som et skift mellem to visninger øverst på siden — den aktive knap er fremhævet.

- **Kanvas-møder** (aktiv som standard): præcis den nuværende side — datovælger, søgning, skabelon, de tre faner (Gennemgang / Afviste salg / Godkendte salg) og alle knapper. Intet ændres.
- **Alle tryg & alka salg**: ny, tom visning med plads til en tabel. Indtil indholdet er defineret, står der en kort besked om at indholdet tilføjes. Ingen data hentes endnu.

Adgangen er uændret (kun ejere og de whitelistede adresser).

## Teknisk

`src/pages/reports/TrygEditSales.tsx`:
- Ny lokal state `view: "kanvas" | "tryg-alka"`.
- I `CardHeader` erstattes `CardTitle`-teksten af to `Button`-elementer (`variant="ghost"`/`"secondary"` afhængigt af aktiv visning, samme størrelse og typografi som titlen i dag). Beskrivelsen under knapperne følger den valgte visning.
- Alt nuværende indhold i `CardContent` (datovælger, søgefelt, skabelon, `Tabs`, dialoger) rendres kun når `view === "kanvas"`.
- Når `view === "tryg-alka"` vises en tom sektion med placeholder-tekst.

Ingen ændringer i hooks, forespørgsler, pricing, provision, løn eller RLS.
