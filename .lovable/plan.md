
# Udvid "Indberet fejl"-dialogen med validering og datofelt

## Oversigt

Opdater PayrollErrorReportDialog med:
- Nyt obligatorisk datofelt (enkelt dato eller periode)
- Alle felter markeret som obligatoriske med visuel feedback
- Beskrivelse kraever minimum 30 tegn

## Database-aendring

Ny migration der tilfojer kolonner til `payroll_error_reports`:
- `error_date_start date` (nullable for bagudkompatibilitet, men kraevet i UI)
- `error_date_end date` (nullable -- kun udfyldt hvis bruger vaelger en periode)

## Fil: `src/components/my-profile/PayrollErrorReportDialog.tsx`

### Nye felter og validering

1. **Datofelt** med toggle mellem "Enkelt dato" og "Periode":
   - Enkelt dato: en datepicker (Calendar/Popover)
   - Periode: to datepickers (fra/til)
   - Obligatorisk -- mindst startdato skal vaelges
   - Begroenset til den valgte loenperiode (min/max)

2. **Validering med fejlmeddelelser**:
   - Kategori: Viser "Vaelg en kategori" hvis tom ved submit-forsoeg
   - Dato: Viser "Vaelg en dato" hvis tom
   - Beskrivelse: Viser "Minimum 30 tegn (X/30)" med tegntaeller
   - Submit-knap disabled indtil alle krav er opfyldt

3. **Visuelt**:
   - Obligatoriske felter markeret med roed stjerne (*)
   - Fejlmeddelelser vises i roedt under felter efter foerste submit-forsoeg
   - Tegntaeller under textarea der viser aktuel laengde vs. minimum

### Teknisk tilgang

- Tilfoej `errorDateStart`, `errorDateEnd`, `isRange` state
- Brug eksisterende Calendar + Popover komponenter til datepicker
- Tilfoej `attempted` state for at vise fejl foerst efter foerste klik paa Send
- Insert sender `error_date_start` og `error_date_end` til databasen
- Validering: `category !== ""`, `errorDateStart !== null`, `description.trim().length >= 30`
