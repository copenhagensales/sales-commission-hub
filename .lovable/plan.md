

# Ny sub-tab "Fejl i match" i Godkendelseskøen

## Hvad
Tilføj en fjerde sub-tab kaldet **"Fejl i match"** i Godkendelseskøen. Den viser alle rækker fra uploads der ikke kunne matches til et salg i systemet — data fra `cancellation_imports.unmatched_rows` (JSONB-kolonnen).

## Ændringer

| Fil | Hvad |
|-----|------|
| `src/components/cancellations/MatchErrorsSubTab.tsx` | **Ny fil.** Henter alle `cancellation_imports` for den valgte kunde hvor `unmatched_rows` ikke er null. Viser rækkerne i en tabel med de uploadede felter (OPP, produkt, beløb osv.), grupperet pr. import (filnavn + dato). Søgefelt og sortering. |
| `src/components/cancellations/ApprovalQueueTab.tsx` | Udvid `subTab` type med `"match_errors"`. Tilføj ny `TabsTrigger` "Fejl i match" med count. Tilføj `TabsContent` der renderer `<MatchErrorsSubTab clientId={clientId} />`. |

## Teknisk detalje

**MatchErrorsSubTab query:**
1. Hent `cancellation_imports` hvor `unmatched_rows IS NOT NULL` og filtret på uploads tilhørende den valgte kundes kampagner (via `cancellation_queue.client_id` eller importens kontekst)
2. Parse `unmatched_rows` JSON-array — hver entry er en Excel-række der ikke matchede
3. Vis i tabel: filnavn, upload-dato, og de uploadede feltværdier (OPP, produkt, beløb etc.)
4. Søgefelt + sortering på upload-dato

**Count i tab-header:**
- Query antal imports med unmatched_rows for badge-visning

