

# Flyt "Afventer" til selvstændig fane efter Mapping

## Overblik
Fanen "Afventer" flyttes fra at være en sub-fane i Godkendelseskøen til at være en selvstændig top-level fane under "Automatisk kontrol", placeret efter "Mapping". Den skal ikke indgå i beregningen af om et upload er "igangværende" (dvs. den blokerer ikke nye uploads).

## Ændringer

### 1. `Cancellations.tsx` — Ny top-level fane
- Tilføj `{ value: 'unmatched', label: 'Afventer' }` efter `mapping` i `autoTabs`
- Tilføj `TabsContent` der renderer `<UnmatchedTab clientId={selectedClientId} />`
- Import `UnmatchedTab`

### 2. `ApprovalQueueTab.tsx` — Fjern "Afventer" sub-fane
- Fjern `TabsTrigger` for `"unmatched"` (linje 1106-1108)
- Fjern `TabsContent` for `"unmatched"` (linje 1142-1144)
- Fjern `unmatchedCount` query (linje 698-715)
- Fjern `UnmatchedTab` import

### 3. Upload-blokering — uændret
Den eksisterende blokerings-logik i `UploadCancellationsTab.tsx` tjekker kun `cancellation_queue` items med `status = 'pending'`. "Afventer"-fanen viser sales med `validation_status = 'pending'` som IKKE er i køen — så den indgår allerede ikke i blokeringen. Ingen ændring nødvendig her.

## Filer
1. `src/pages/salary/Cancellations.tsx`
2. `src/components/cancellations/ApprovalQueueTab.tsx`

