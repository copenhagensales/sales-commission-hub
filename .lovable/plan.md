

# Upload-type dropdown + godkendelses-kø for annulleringer

## Overblik
Tilføj en dropdown til at vælge upload-type (Annullering / Kurv difference) og send matchede salg til en godkendelses-kø i stedet for direkte at annullere dem. En ny fane viser ventende matches til manuel godkendelse.

## Database

### Ny tabel: `cancellation_queue`
| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid PK | |
| import_id | uuid FK → cancellation_imports | Hvilken upload det hører til |
| sale_id | uuid FK → sales | Matchet salg |
| upload_type | text | `'cancellation'` eller `'basket_difference'` |
| status | text | `'pending'` / `'approved'` / `'rejected'` (default: `'pending'`) |
| reviewed_by | uuid FK → employee_master_data | Hvem godkendte |
| reviewed_at | timestamptz | Tidspunkt for godkendelse |
| created_at | timestamptz | |

### Ændring: `cancellation_imports`
- Tilføj kolonne `upload_type text default 'cancellation'`

## Kodeændringer

### 1. `src/components/cancellations/UploadCancellationsTab.tsx`
- Tilføj `uploadType` state (`'cancellation' | 'basket_difference'`)
- Tilføj dropdown i mapping-stedet: "Upload-type" med valgmuligheder "Annullering" og "Kurv difference"
- Ændr `bulkCancelMutation`: I stedet for at sætte `validation_status = 'cancelled'`, indsæt rækker i `cancellation_queue` med `status = 'pending'`
- Log `upload_type` i `cancellation_imports`

### 2. Ny: `src/components/cancellations/ApprovalQueueTab.tsx`
- Hent ventende items fra `cancellation_queue` joined med `sales` og `cancellation_imports`
- Vis tabel: Salgsdato, Sælger, Telefon, Virksomhed, OPP, Upload-type, Filnavn, Uploadet af
- Handlinger per række: Godkend / Afvis
- Bulk-handlinger: Godkend alle / Afvis alle for en import
- Ved godkendelse af "cancellation": sæt `sales.validation_status = 'cancelled'`
- Ved godkendelse af "basket_difference": sæt `sales.validation_status = 'basket_changed'` (eller tilsvarende)

### 3. `src/pages/salary/Cancellations.tsx`
- Tilføj ny fane "Godkendelseskø" med permission `tab_cancellations_approval`
- Render `ApprovalQueueTab` i den nye fane

| Fil | Ændring |
|-----|---------|
| Migration | Opret `cancellation_queue` tabel + tilføj `upload_type` til `cancellation_imports` |
| `UploadCancellationsTab.tsx` | Upload-type dropdown + send til kø i stedet for direkte annullering |
| `ApprovalQueueTab.tsx` | Ny komponent: godkendelses-kø med approve/reject |
| `Cancellations.tsx` | Tilføj "Godkendelseskø" fane |

