# Upload-faneblad: to dropzones på "Eesy FM afvigelser"

## Hvad der bygges

I Upload-fanen på siden "Afstem automatisk salg" tilføjes et upload-kort med samme udseende som annulleringsuploaden:

- Korttitel med upload-ikon: **Upload kurv-fil**
- Kort beskrivelse under titlen: "Upload Excel-filer (.xlsx). Én fil for Gaden/Coop og én for Marked."
- To dropzones side om side (stakket på mobil):
  - Venstre: label **GADEN/COOP** — "Træk og slip Gaden/Coop-fil" / "eller klik for at vælge"
  - Højre: label **MARKED** — "Træk og slip Marked-fil" / "eller klik for at vælge"
- Ingen opsætnings-linje og ingen Tilbage-knap.

Adfærd i dette trin: hver dropzone accepterer kun .xlsx, én fil ad gangen. Når en fil er valgt, skifter feltet til en grøn "valgt fil"-visning med filnavn og en "Skift fil"-knap — præcis som i annulleringsuploaden. Filerne holdes i state; ingen parsing, matching eller upload til backend endnu (det kommer i næste prompt).

## Teknisk

- Fil: `src/pages/vagt-flow/EesyFmDeviations.tsx` (Upload-fanens indhold).
- `useDropzone` fra `react-dropzone` (allerede i projektet), `accept` sat til `.xlsx` (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`), `maxFiles: 1` pr. zone.
- Styling genbruges 1:1 fra `src/components/cancellations/UploadCancellationsTab.tsx:2836-2900`: `border-2 border-dashed rounded-lg p-8`, `border-primary bg-primary/5` ved drag, `border-success/40 bg-success/5` når fil er valgt, ikoner `Upload` / `FileSpreadsheet` / `X` fra lucide.
- To lokale `useState<File | null>` (gadenCoopFile, markedFile). Ingen nye filer, hooks eller DB-ændringer.
