

## Plan: Synkroniser PDF og email-rapport med UI-ændringerne

Tre ting skal opdateres: (1) PDF-generatoren, (2) email-rapporten, og (3) de data der sendes til begge.

### 1. Udvid data der sendes til PDF og email

**`src/components/billing/SupplierReportTab.tsx`**

- **PDF-kaldet (linje 761-776):** Tilføj `weekdaysByWeek` data til hver lokation (konverteret fra Map til serialiserbar struktur: `Array<{ week: number, days: number[] }>`). Erstat `period: formatDateRange(...)` med denne struktur.
- **Email-kaldet (linje 827-836):** Tilføj samme `weekdaysByWeek` data til `reportData`.

### 2. Opdater PDF-generatoren

**`src/utils/supplierReportPdfGenerator.ts`**

- **Interface `LocationRow`:** Erstat `period: string` med `weekdays: Array<{ week: number, days: number[] }>`.
- **Kolonne-header (linje 241):** `"Periode"` → `"Uger & Dage"`.
- **Celle-rendering (linje 68):** Erstat `${loc.period}` med HTML der viser uge-badges:
  - Hver uge: `Uge X` label + weekday badges (`Man`, `Tir`, osv.)
  - Fulde hverdagsuger (0-4 alle til stede) → én `Man–Fre` badge
- **CSS:** Tilføj styles til `.week-row`, `.week-label` og `.day-badge` klasser.
- **Rabatsektion (linje 136-154):** Opdater placement-teksten fra "Bookinger" til at inkludere "1 placering = min. X dage" info (kræver `minDaysPerLocation` som ny config-property).

### 3. Opdater email-rapporten

**`supabase/functions/send-supplier-report/index.ts`**

- **Tabel-header (linje 84-91):** Tilføj "Uger & Dage" kolonne, fjern den simple "Dage" kolonne eller erstat den.
- **Tabel-rækker (linje 62-70):** Render `weekdays` array som inline HTML med uge-numre og ugedags-labels (simple tekst, da email-klienter har begrænset CSS-support).
- Brug inline styles til badges (kompatibelt med email-klienter).

### Opsummering af ændrede filer

| Fil | Ændring |
|-----|---------|
| `SupplierReportTab.tsx` | Send `weekdays` data til PDF og email |
| `supplierReportPdfGenerator.ts` | Ny kolonne med uge-badges + opdateret rabattekst |
| `send-supplier-report/index.ts` | Ny kolonne med uge-badges i email HTML |

