

## Systemforbedringer / Fejlrapportering fra ledere

### Idé
En simpel formular hvor ledere kan indrapportere problemer, ønsker og forbedringsforslag. Hver indrapportering indeholder screenshot, beskrivelse, berørt bruger og prioritet. Du kan derefter tage screenshots + brugernavne direkte ind i Lovable for hurtig fejlsøgning.

### Ekstra overvejelser
- **Kategori**: Skelne mellem "fejl/bug", "forbedringsforslag" og "ny funktion" — giver overblik over hvad der haster vs. nice-to-have
- **Status-tracking**: Så lederne kan se om deres indrapportering er set/under arbejde/løst — reducerer "har I set min besked?"-spørgsmål
- **Side/sektion-felt**: Hvilken del af systemet handler det om (f.eks. "Salg", "Vagtplan", "Dashboard") — hurtigere at finde fejlen
- **Duplikat-forebyggelse**: Ledere kan se eksisterende indrapporteringer og evt. "stemme op" i stedet for at oprette en ny

### Database

**Ny tabel: `system_feedback`**

| Kolonne | Type | Beskrivelse |
|---|---|---|
| id | uuid PK | |
| submitted_by | uuid FK → employee_master_data | Lederen der indrapporterer |
| affected_employee_name | text | Navn på brugeren der oplever problemet |
| category | text | 'bug', 'improvement', 'feature_request' |
| priority | text | 'critical', 'high', 'medium', 'low' |
| title | text | Kort overskrift |
| description | text | Detaljeret beskrivelse |
| system_area | text | Hvilken del af systemet (valgfrit) |
| screenshot_url | text | URL til uploadet screenshot |
| status | text | 'new', 'seen', 'in_progress', 'resolved', 'wont_fix' |
| admin_notes | text | Dine noter (kun synlige for dig) |
| created_at | timestamptz | |

**Storage bucket**: `feedback-screenshots` (public read, authenticated upload)

RLS: Authenticated users kan oprette + læse egne. Owners/teamledere kan læse alle.

### UI

**1. Ny side: `/system-feedback`**
- Tilgængelig fra sidebar under "Administration" (for teamledere+)
- Simpel formular med:
  - **Overskrift** (kort titel)
  - **Kategori** (Fejl / Forbedring / Ny funktion) — dropdown
  - **Prioritet** (Kritisk / Høj / Medium / Lav) — farvekodede knapper
  - **Berørt bruger** — tekstfelt med navn
  - **Systemområde** — dropdown (Salg, Vagtplan, Dashboard, Annulleringer, osv.)
  - **Beskrivelse** — textarea
  - **Screenshot** — drag-and-drop eller klik-upload
- Bekræftelse via toast efter indsendelse

**2. Liste-visning (for dig/ejer)**
- Tabel med alle indrapporteringer, sorteret efter prioritet + dato
- Filtre: kategori, prioritet, status
- Klik for at se detaljer + screenshot
- Mulighed for at ændre status og tilføje admin-noter
- Eksporter-knap så du kan copy-paste direkte ind i Lovable

**3. Sidebar-link**
- Tilføj "Fejlrapportering" under administration i sidebar

### Filer der oprettes/ændres
1. **Migration**: Opret `system_feedback` tabel + storage bucket + RLS
2. **Ny side**: `src/pages/SystemFeedback.tsx` — formular + liste
3. **Route**: Tilføj til `src/routes/config.tsx` + `src/routes/pages.ts`
4. **Sidebar**: Tilføj link i `DashboardSidebar.tsx`

### Simpelhed
Formularen er designet til at tage under 1 minut at udfylde. Screenshot + brugernavn + beskrivelse giver dig alt du behøver for at fejlsøge direkte i Lovable.

