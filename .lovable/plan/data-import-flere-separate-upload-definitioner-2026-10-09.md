# Data import: flere separate upload-definitioner

## Hvad der bygges
Under "Manuelle data upload":

- **Liste over upload-definitioner** i venstre side, fx "Eesy TM kurvrettelser & salgsmatching". Senere kan der komme fx "TDC Erhverv kurvrettelser/annullering/salgsafstemning".
- Knappen **"Ny definition"** åbner en formular med navn, kunde (vælges fra listen over kunder) og en kort beskrivelse.
- Når man vælger en definition, vises **kun dens egne** kategorier, sletteregler og kolonner. Kategorier deles ikke mellem definitionerne. Fx kan "Kundetelefon" være 90 dage hos Eesy TM og 365 dage hos TDC uden at påvirke hinanden.
- Hver definition har sin egen status ("Alle kolonner defineret" eller "X mangler").
- En ny definition **påvirker ingen upload**, før den er koblet til en upload. I dag er kun Eesy TM koblet på. Definitionen markeres "Ikke koblet til upload endnu", så det er tydeligt.

## Afgrænsning
- Eesy TM-filteret og sletjobbet fungerer som nu. Det er kun knyttet til Eesy TM's definition.
- Der kobles ingen upload til TDC eller andre i denne omgang.
- Kun ejere kan oprette og redigere.

## Teknisk
- Migration:
  - `data_import_categories` får `definition_id` (FK til definitions). Unikt navn gælder pr. definition i stedet for globalt.
  - Eksisterende kategorier, hvis der er nogen, får Eesy TM's definition.
  - `data_import_definitions` får `description` og `upload_linked boolean default false`. Eesy TM sættes til true.
- Sletjobbet joiner kategorien via samme definition (`c.definition_id = d.id`), så Eesy-reglerne aldrig læser andre definitioners kategorier.
- `useDataImportRules`:
  - Henter alle definitioner.
  - Kategorier og kolonner filtreres på den valgte definition.
  - Ny mutation `useCreateDefinition`. Nøglen genereres ud fra navnet.
- `ManualUploadRules.tsx` opdeles i en definitionsliste og en detaljevisning for den valgte definition.
- Ingen ændring i `UploadCancellationsTab.tsx`.
