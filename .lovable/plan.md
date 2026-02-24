

# Plan: Leverandør-kontaktpersoner og "Send til leverandør"-funktion

## Overblik

Tilføj en ny fane **"Kontaktpersoner"** i Faktureringsrapport-siden, hvor I kan administrere kontaktpersoner for hver leverandørtype (f.eks. Ocean Outdoor, Danske Shoppingcentre). Når en rapport er godkendt i Leverandørrapport-fanen, vises automatisk en **"Send til [Leverandørnavn]"**-knap, som sender rapporten som en pæn HTML-email til kontaktpersonen.

---

## Funktioner

### 1. Ny database-tabel: `supplier_contacts`

Opretter en tabel til at gemme kontaktpersoner per leverandørtype:

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| `id` | uuid | Primær nøgle |
| `location_type` | text | Leverandørtype (f.eks. "Ocean Outdoor") |
| `contact_name` | text | Kontaktpersonens navn |
| `contact_email` | text | Email-adresse |
| `contact_phone` | text (valgfri) | Telefonnummer |
| `is_primary` | boolean | Om dette er den primære kontakt |
| `is_active` | boolean | Aktiv/inaktiv |
| `created_at` / `updated_at` | timestamp | Tidsstempler |

Hver leverandørtype kan have flere kontaktpersoner, men kun den primære bruges til "Send rapport".

### 2. Ny fane: "Kontaktpersoner"

En ny fane i Faktureringsrapport-siden med:
- **Oversigt** over alle kontaktpersoner grupperet efter leverandørtype
- **Tilføj kontaktperson** med navn, email, telefon, og leverandørtype
- **Rediger/slet** eksisterende kontaktpersoner
- **Marker som primær** kontakt per leverandørtype
- Visuelt ikon der viser hvilke leverandørtyper der mangler en kontaktperson

### 3. "Send til leverandør"-knap i Leverandørrapport-fanen

Når en rapport er **godkendt**:
- Knappen vises automatisk ved siden af "Godkendt"-badge og "Download PDF"
- Tekst: **"Send til Ocean Outdoor"** (med leverandørnavnet)
- Under knappen vises kontaktpersonens navn og email i lille tekst
- Hvis der ikke er opsat en kontaktperson, vises en advarsel med link til Kontaktpersoner-fanen

### 4. Ny Edge Function: `send-supplier-report`

Sender rapporten som en professionel HTML-email via M365 Graph API (samme mønster som eksisterende email-funktioner i projektet):
- Modtager: kontaktpersonens email
- Emne: "Faktureringsrapport - [Leverandørtype] - [Måned År]"
- Indhold: HTML-tabel med alle lokationer, dage, beløb, rabatter, og totaler
- Logger afsendelsen i `supplier_invoice_reports` tabellen (ny kolonne `sent_at` og `sent_to_email`)

### 5. Statussporing

Tilføj kolonner til `supplier_invoice_reports`:
- `sent_at` (timestamp) - hvornår rapporten blev sendt
- `sent_to_email` (text) - hvem den blev sendt til
- `sent_by` (uuid) - hvem der sendte den

Efter afsendelse vises: "Sendt til [navn] ([email]) d. [dato]" i stedet for knappen.

---

## Ekstra ideer

- **Bekræftelsesdialog** inden afsendelse: "Er du sikker på at du vil sende rapporten til [navn] ([email])?" - forhindrer fejl
- **Genvejen "Send igen"**: Mulighed for at sende rapporten igen, hvis kontaktpersonen f.eks. ikke har modtaget den
- **CC-felt**: Mulighed for at tilføje ekstra modtagere ved afsendelse
- **Historik**: En log over alle sendte rapporter med dato, modtager og status

---

## Tekniske detaljer

### Database-migrering

```sql
-- 1. Ny tabel: supplier_contacts
CREATE TABLE supplier_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  location_type TEXT NOT NULL,
  contact_name TEXT NOT NULL,
  contact_email TEXT NOT NULL,
  contact_phone TEXT,
  is_primary BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Nye kolonner på supplier_invoice_reports
ALTER TABLE supplier_invoice_reports 
  ADD COLUMN sent_at TIMESTAMPTZ,
  ADD COLUMN sent_to_email TEXT,
  ADD COLUMN sent_by UUID;

-- 3. RLS policies
```

### Nye filer

| Fil | Beskrivelse |
|-----|-------------|
| `src/components/billing/SupplierContactsTab.tsx` | Ny fane-komponent med CRUD for kontaktpersoner |
| `supabase/functions/send-supplier-report/index.ts` | Edge function der sender rapporten via M365 |

### Ændrede filer

| Fil | Ændring |
|-----|---------|
| `src/pages/vagt-flow/Billing.tsx` | Tilføj ny "Kontaktpersoner"-fane |
| `src/components/billing/SupplierReportTab.tsx` | Tilføj "Send til leverandør"-knap efter godkendelse |

### Flow

```text
1. Bruger opretter kontaktperson for "Ocean Outdoor" i Kontaktpersoner-fanen
2. Bruger genererer rapport i Leverandørrapport-fanen for "Ocean Outdoor"
3. Bruger godkender rapporten → "Send til Ocean Outdoor"-knap vises
4. Bruger klikker "Send til Ocean Outdoor"
5. Bekræftelsesdialog: "Send rapport til Anders Jensen (anders@ocean.dk)?"
6. Edge function sender HTML-email via M365
7. Status opdateres: "Sendt til Anders Jensen d. 24/02/2026 kl. 13:45"
```

