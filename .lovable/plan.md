# Ny boks "Fejl i upload" under Bulk Salg (Leder)

## Mål
Under kortet "Upload bulk-fil" tilføjes et nyt kort med titlen "Fejl i upload", som viser en tabel med tre kolonner: Årsag, Sælger, Emne-id.

## Sådan ser det ud
- Kort med overskrift "Fejl i upload" (advarsels-ikon).
- Tabel med kolonneoverskrifter: Årsag | Sælger | Emne-id.
- Ingen data endnu — tom tilstand viser "Ingen fejl" i tabellen. Rækker fyldes ud når selve upload-behandlingen bygges i næste trin.

## Teknisk
- Kun `src/pages/TastSelvSalg.tsx` (grøn zone, ren UI). Kortet vises kun når `activeChannel === BULK_TAB` og `isOwner`, dvs. lige under `<BulkUploadCard />`.
- Ny lokal komponent `BulkUploadErrorsCard` i samme fil, med shadcn `Table`-komponenterne (`Table`, `TableHeader`, `TableRow`, `TableHead`, `TableBody`, `TableCell`).
- Ingen ændringer i hooks, DB, edge functions eller rettigheder. De to andre faner er uberørte.
