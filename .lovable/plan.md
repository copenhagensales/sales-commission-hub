

# Plan: Leverandør-kontaktpersoner og "Send til leverandør"-funktion

## Baggrund

Fakturerings-siden (`/vagt-flow/billing`) har i dag 3 faner: **Oversigt**, **Leverandørrapport** og **Rabataftaler**. Der mangler en fane til at administrere leverandør-kontaktpersoner og sende godkendte rapporter direkte til leverandøren via e-mail.

Der er 5 leverandørtyper i systemet: Butik, Danske Shoppingcentre, Markeder, Ocean Outdoor, Storcenter.

---

## Nye funktioner

### 1. Ny databasetabel: `supplier_contacts`

Gemmer kontaktpersoner per leverandørtype (location_type):

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid (PK) | Auto-genereret |
| location_type | text | Leverandørtype (fx "Danske Shoppingcentre") |
| name | text | Kontaktpersonens navn |
| email | text | E-mail adresse |
| phone | text (nullable) | Telefonnummer |
| role | text (nullable) | Stilling/rolle |
| is_primary | boolean | Primær kontakt for denne type |
| is_active | boolean | Aktiv/inaktiv |
| created_at | timestamptz | Oprettelsestidspunkt |

RLS policies for authenticated users (read/insert/update/delete).

### 2. Ny fane: "Kontaktpersoner"

Tilføjes som 4. fane på Fakturerings-siden.

**Indhold:**
- Vælg leverandørtype (dropdown med de 5 typer)
- Tabel med kontaktpersoner for den valgte type: Navn, E-mail, Telefon, Rolle, Primær (badge)
- Knapper til at tilføje, redigere og slette kontaktpersoner
- Dialog til oprettelse/redigering med formularfelter

### 3. "Send til leverandør"-knap på Leverandørrapporten

Tilføjes ved siden af "Download PDF" og "Godkend rapport" knapperne i `SupplierReportTab`:

- Knappen er kun aktiv når rapporten er **godkendt**
- Ved klik: Viser en dialog med:
  - Forhåndsvisning af modtagere (kontaktpersoner for den valgte leverandørtype)
  - Mulighed for at tilføje ekstra e-mail-adresser
  - Emne og besked (forudfyldt med "Leverandørrapport: [Type] - [Måned]")
  - Send-knap
- Sender via en ny edge function (`send-supplier-report`) der bruger Microsoft Graph (M365) ligesom `send-recruitment-email`
- Vedhæfter PDF-rapporten som genereres server-side

---

## Tekniske detaljer

### Nye filer

| Fil | Beskrivelse |
|-----|-------------|
| `src/components/billing/SupplierContactsTab.tsx` | Ny fane-komponent med CRUD for kontaktpersoner |
| `src/components/billing/SupplierContactDialog.tsx` | Dialog til oprettelse/redigering af kontaktperson |
| `src/components/billing/SendToSupplierDialog.tsx` | Dialog til at sende rapport via e-mail |
| `supabase/functions/send-supplier-report/index.ts` | Edge function til e-mail-afsendelse via M365 |

### Ændrede filer

| Fil | Ændring |
|-----|---------|
| `src/pages/vagt-flow/Billing.tsx` | Tilføj 4. fane "Kontaktpersoner" |
| `src/components/billing/SupplierReportTab.tsx` | Tilføj "Send til leverandør"-knap (kræver godkendt rapport) |

### Edge function: `send-supplier-report`

- Modtager: `{ locationType, month, recipients[], subject, message, reportData }`
- Genererer PDF server-side (eller modtager rapport-data til HTML-formatering)
- Sender via Microsoft Graph med eksisterende M365-credentials
- Logger afsendelse i `supplier_invoice_reports` (tilføj `sent_at` og `sent_to` kolonner)

### Database-migrering

```text
1. CREATE TABLE supplier_contacts (...)
2. ADD COLUMN sent_at, sent_to TO supplier_invoice_reports
3. RLS policies for supplier_contacts
```

## Implementeringsrækkefølge

```text
1. Opret supplier_contacts tabel + RLS
2. Tilføj sent_at/sent_to kolonner til supplier_invoice_reports
3. Opret SupplierContactsTab + SupplierContactDialog
4. Tilføj fanen til Billing.tsx
5. Opret SendToSupplierDialog
6. Opret send-supplier-report edge function
7. Integrer "Send til leverandør"-knap i SupplierReportTab
```

