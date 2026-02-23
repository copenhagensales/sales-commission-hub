

# Tilfoej "Indberet fejl"-knap med dialogboks i Loen-fanen

## Oversigt

Tilfoej en knap over loensektionen i Loen-fanen, hvor medarbejderen kan indberette fejl i sin loen. Klik paa knappen aabner en dialogboks med et formular.

## Nye elementer

### Database: Ny tabel `payroll_error_reports`

Opretter en tabel til at gemme indberettede fejl:

- `id` (uuid, PK)
- `employee_id` (uuid, FK til employee_master_data)
- `payroll_period_start` (date) -- periodens startdato
- `payroll_period_end` (date) -- periodens slutdato
- `category` (text) -- type fejl, f.eks. "Provision", "Vagt", "Diet", "Andet"
- `description` (text) -- fritekstbeskrivelse
- `status` (text, default 'pending') -- pending / resolved
- `created_at` (timestamptz)

RLS: Medarbejdere kan oprette og se egne indberetninger. Teamledere+ kan se alle.

### Fil: `src/components/my-profile/PayrollErrorReportDialog.tsx` (ny)

En Dialog-komponent med:
- Trigger-knap med ikon (AlertTriangle) og tekst "Indberet fejl"
- Formular med:
  - **Kategori** (Select): Provision, Vagt, Diet, Dagsbonus, Feriepenge, Andet
  - **Beskrivelse** (Textarea): Fritekst til at forklare fejlen
- "Send" knap der gemmer til `payroll_error_reports` med den aktuelle periodes datoer og medarbejder-id
- Toast-besked ved succes

### Fil: `src/pages/MyGoals.tsx` (aendres)

- Importer `PayrollErrorReportDialog`
- Placer knappen i Loen-fanen mellem periodeselector og PayrollDayByDay, hoejrestillet:

```text
  [ < 15. jan - 14. feb > ]
                              [ Indberet fejl ]
  +-----------+-----------+---
  | Provision | Feriepenge| ...
```

Knappen faar `employeeId`, `payrollPeriod` (start/end) som props.

## Raekkefoelge

1. Opret `payroll_error_reports`-tabel med RLS
2. Opret `PayrollErrorReportDialog.tsx`
3. Integrer i `MyGoals.tsx`

