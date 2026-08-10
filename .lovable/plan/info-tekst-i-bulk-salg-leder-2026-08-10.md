# Info-tekst i "Bulk Salg (Leder)"

## Mål
Erstat placeholder-teksten "Beskrivelse indsættes her." i Info-boksen under fanen "Bulk Salg (Leder)" med vejledningen til Adversus-udtrækket.

## Indhold der indsættes
To korte afsnit med lister:

**I Adversus under filtre:**
- Vælg Status = Succes
- For Datobegrænsning brug "Sidste Kontakttidspunkt" (valgfrit)

**I Adversus under kolonner vælg i denne rækkefølge:**
1. Sidst kontaktet af
2. Mobil
3. Kampagne
4. Status

Afsluttende note: Rækkefølgen i listen bestemmer kolonnernes rækkefølge i excel-filen. Ikonerne til højre for hvert felt bruges til at redigere, låse og fjerne kolonnen.

## Teknisk
- Kun `src/pages/TastSelvSalg.tsx` ændres, linje 164-166 (grøn zone, ren tekst/UI).
- Struktureres med overskrifter, `<ul>` og `<ol>` i `CardContent`, semantiske tokens til farver.
- Ingen ændringer i de to andre faner, hooks, DB eller rettigheder.
