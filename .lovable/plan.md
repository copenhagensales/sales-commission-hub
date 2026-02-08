
# Plan: Annulleringer-side under Løn-menuen

## Oversigt
Denne plan implementerer en ny side kaldet "Annulleringer" under Løn-menuen med to faner:
1. **Manuelle annulleringer** - Søg salg frem per kunde og marker dem som annulleret
2. **Upload/match annulleringer** - Upload Excel-fil med annulleringer og match dem mod eksisterende salg

---

## Hvad der vil blive bygget

### Fane 1: Manuelle annulleringer
- Dropdown til at vælge kunde (henter alle kunder fra `clients` tabellen)
- Dato-filter for at indsnævre søgningen
- Søgefelt til at finde specifikke salg (telefonnummer, sælger, virksomhed)
- Tabel med salg der viser:
  - Salgsdato
  - Sælger
  - Kunde/telefon
  - Nuværende status
  - Annuller-knap
- Ved klik på "Annuller" opdateres `validation_status` til "cancelled" i `sales` tabellen

### Fane 2: Upload/match annulleringer
- Drag-and-drop zone til Excel-upload (xlsx format)
- Automatisk kolonnemapping-interface (lignende ExcelFieldMatcher)
- Preview af matchede rækker før import
- Bulk-opdatering af salg til "cancelled" status
- Historik over tidligere uploads

---

## Tekniske detaljer

### Nye filer der oprettes

| Fil | Beskrivelse |
|-----|-------------|
| `src/pages/salary/Cancellations.tsx` | Hovedsiden med fane-struktur |
| `src/components/cancellations/ManualCancellationsTab.tsx` | Fane til manuel annullering |
| `src/components/cancellations/UploadCancellationsTab.tsx` | Fane til upload/match |
| `src/components/cancellations/CancellationHistoryTable.tsx` | Tabel over upload-historik |

### Filer der modificeres

| Fil | Ændring |
|-----|---------|
| `src/routes/pages.ts` | Tilføj lazy-load export for Cancellations |
| `src/routes/config.tsx` | Tilføj route `/salary/cancellations` |
| `src/components/layout/AppSidebar.tsx` | Tilføj menupunkt "Annulleringer" under Løn |
| `src/hooks/usePositionPermissions.ts` | Tilføj `canViewCancellations` permission |

### Database-ændringer

Der oprettes en ny tabel til at spore annullerings-uploads:

```text
+--------------------------------+
|   cancellation_imports         |
+--------------------------------+
| id (uuid, PK)                  |
| created_at (timestamptz)       |
| uploaded_by (uuid, FK users)   |
| file_name (text)               |
| file_size_bytes (integer)      |
| status (text)                  |
| rows_processed (integer)       |
| rows_matched (integer)         |
| error_message (text)           |
+--------------------------------+
```

Der oprettes også en permission i `role_page_permissions`:
- `menu_cancellations` - styrer adgang til Annulleringer-siden

### Implementerings-flow

1. **Route & Navigation**
   - Tilføj `/salary/cancellations` route
   - Tilføj menupunkt i sidebar under Løn
   - Permission-gate via `menu_cancellations`

2. **Manuel annullering**
   - Hent kunder fra `clients` tabel
   - Søg salg via Supabase query med filtre
   - Update `validation_status = 'cancelled'` ved klik

3. **Upload/match**
   - Brug react-dropzone til fil-upload
   - Parse Excel med xlsx-biblioteket
   - Match mod salg baseret på kundedata (telefon, opp-nummer, etc.)
   - Vis preview og bekræft før bulk-opdatering

---

## Visuel struktur

```text
┌─────────────────────────────────────────────────────────┐
│ Annulleringer                                           │
│ Administrer manuelle og bulk-annulleringer af salg      │
├─────────────────────────────────────────────────────────┤
│ [Manuelle annulleringer] [Upload/match annulleringer]   │
├─────────────────────────────────────────────────────────┤
│                                                         │
│  Manuelle annulleringer-fane:                          │
│  ┌─────────────┐ ┌─────────────┐ ┌────────────────┐    │
│  │ Vælg kunde ▼│ │ Dato filter │ │ 🔍 Søg...     │    │
│  └─────────────┘ └─────────────┘ └────────────────┘    │
│                                                         │
│  ┌───────────────────────────────────────────────────┐ │
│  │ Dato       │ Sælger    │ Kunde    │ Status │ ⚡   │ │
│  │ 08/02/2026 │ Kasper M. │ Firma A  │ pending│ 🗑️   │ │
│  │ 07/02/2026 │ Maria L.  │ Firma B  │ pending│ 🗑️   │ │
│  └───────────────────────────────────────────────────┘ │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Afhængigheder
- Eksisterende `clients` og `sales` tabeller
- react-dropzone (allerede installeret)
- xlsx bibliotek (allerede installeret)
- Radix UI Tabs komponenter

## Risici og håndtering
- **Mange salg**: Pagination implementeres for at undgå performance-problemer
- **Forkert matching**: Preview-step før bulk-opdatering sikrer brugeren kan verificere

---

## Estimeret omfang
- 4 nye komponenter
- 4 fil-modifikationer
- 1 database-migration
- 1 permission-record
