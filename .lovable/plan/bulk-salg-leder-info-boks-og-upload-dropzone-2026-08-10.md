# Bulk Salg (Leder) — Info-boks og upload-dropzone

## Mål
Fanen "Bulk Salg (Leder)" får sit eget indhold: en "Info"-boks øverst og en enkelt dropzone til .xlsx-filer nedenunder. De øvrige faner ("Lederne", "Hiper Bredbånd") ændres ikke.

## Sådan gøres det
- Placeholder-kortet "Bulk Salg (Leder)" erstattes af et kort med titlen "Info". Indholdet er indtil videre en kort pladsholdertekst — den endelige tekst indsættes når du sender den.
- Kortet "Mine seneste salg" skjules når man står på Bulk Salg-fanen (det bliver ved at virke som i dag på de to andre faner).
- I stedet vises et kort med én stiplet dropzone, i stil med billede 2: upload-ikon, lille label, overskrift "Træk og slip Excel-fil", hjælpetekst "eller klik for at vælge". Accepterer kun `.xlsx`.
- Valgt fil vises med filnavn og mulighed for at fjerne den igen. Ingen upload/behandling endnu — det bygger vi i næste trin.

## Teknisk
- Kun `src/pages/TastSelvSalg.tsx` ændres (grøn zone, ren UI).
- "Mine seneste salg" flyttes ind i en betingelse på `activeChannel !== BULK_TAB`, så statistik-kortene i toppen forbliver uændrede.
- Dropzone laves som lokal komponent i samme fil med `useState` for valgt fil + drag/drop-handlers og skjult `<input type="file" accept=".xlsx">`.
- Ingen ændringer i hooks, edge functions, DB eller rettigheder. Ejer-tjekket (`isOwner`) er uændret.
