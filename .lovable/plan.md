

# Omdoeb fanen og tilfoej afvisning som mulighed

## Oversigt
Fanen "Manuelle annulleringer" omdoebes til "Annuller/afvis", og CancellationDialog udvides saa brugeren kan vaelge mellem at **annullere** eller **afvise** salg/produkter.

## Aendringer

### 1. Omdoeb fanen
I `Cancellations.tsx`: Aendr TabsTrigger-teksten fra "Manuelle annulleringer" til "Annuller/afvis".

### 2. Opdater knappen i tabellen
I `ManualCancellationsTab.tsx`: Aendr knap-teksten fra "Annuller" til "Annuller/afvis".

### 3. Udvid CancellationDialog med afvisnings-mulighed
I `CancellationDialog.tsx`:

**Per produkt (raekke-niveau):**
- Aendr "Annuller 1 stk"-knappen til to knapper: "Annuller 1 stk" og "Afvis 1 stk"
- Ved afvisning saettes `is_cancelled = true` (eller tilsvarende) men `validation_status` paa salget saettes til `rejected` i stedet for `cancelled`

**Hele salget (footer):**
- Tilfoej en "Afvis hele salget"-knap ved siden af "Annuller hele salget"
- "Afvis hele salget" saetter `sales.validation_status = 'rejected'` og markerer alle items

**Dialog-titel:**
- Opdater beskrivelsen til at naevne baade annullering og afvisning

### Tekniske detaljer

**Filer der aendres:**
- `src/pages/salary/Cancellations.tsx` - omdoeb fane-tekst
- `src/components/cancellations/ManualCancellationsTab.tsx` - omdoeb knap-tekst
- `src/components/cancellations/CancellationDialog.tsx` - tilfoej afvis-mutations og UI

**Ingen database-aendringer** - `validation_status` understotter allerede vaerdien `rejected`.

**Nye mutations i CancellationDialog:**
- `rejectOneUnitMutation` - samme logik som `cancelOneUnitMutation` men med `rejected` status-kontekst
- `rejectAllMutation` - saetter `validation_status = 'rejected'` paa salget og markerer alle items

