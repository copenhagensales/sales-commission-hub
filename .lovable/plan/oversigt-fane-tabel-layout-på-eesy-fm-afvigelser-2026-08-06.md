# Oversigt-fane: tabel-layout på Eesy FM afvigelser

Kun layout — ingen data, ingen forretningslogik.

## Hvad der bygges

I fanen "Oversigt" på `/vagt-flow/eesy-fm-deviations`:

1. **Titel + kort beskrivelse** øverst i kortet: "Afvigelser — oversigt" med undertekst.
2. **Filterrække** i toppen (samme opsætning som annulleringsskærmen):
   - Fra dato (kalender-popover)
   - Til dato (kalender-popover)
   - Søg (alle felter) — inputfelt med søgeikon
   - Vælg medarbejder — dropdown/kombiboks
   Alle felter er visuelle/lokale `useState` uden filtrering af data endnu.
3. **Tabel** med kolonner: Salgsdato, Sælger, Mobil, Afvigelse, Tastselv, PowerBI, Type.
   - Bruger shadcn `Table` i et `Card` med samme mørke stil som resten af siden.
   - Tom tilstand: én række med "Ingen data endnu" på tværs af kolonnerne.

## Teknisk

- Ændrer kun `src/pages/vagt-flow/EesyFmDeviations.tsx` (grøn zone: layout).
- Filterrækken lægges i en lokal underkomponent i samme fil for læsbarhed.
- Komponenter fra `@/components/ui`: `card`, `table`, `input`, `button`, `calendar`, `popover`, `select`. `date-fns` med `da`-locale til datovisning.
- Ingen hooks mod Supabase, ingen nye ruter/rettigheder.
