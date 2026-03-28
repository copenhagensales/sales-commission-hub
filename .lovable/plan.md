

## Revideret plan: Compliance-notifikationer med dynamiske modtagere

### Hvad ændres i forhold til den tidligere plan

- **Drop** automatisk påmindelse om leverandør-review (ikke relevant)
- **Tilføj** en ny fane "Notifikationer" i Compliance-sektionen, hvor admins kan administrere hvem der modtager compliance-relaterede notifikationer
- **Opdater** "Sidst vurderet"-datoerne til 28.03.2026 i leverandørtabellen

### 1. Opdater dato i leverandørtabel

**Fil:** `src/pages/compliance/AdminDocumentation.tsx`
- Erstat begge `[dato]`-badges med `28.03.2026` i grønne badges

### 2. Database — ny tabel `compliance_notification_recipients`

| Kolonne | Type | Beskrivelse |
|---------|------|-------------|
| id | uuid PK | |
| employee_id | uuid FK → employee_master_data | Modtager |
| created_at | timestamptz | |
| created_by | uuid FK → auth.users | Hvem tilføjede modtageren |

RLS: Kun ejere/admins kan læse og skrive.

### 3. Ny side/fane: Compliance Notifikationer

**Fil:** `src/pages/compliance/ComplianceNotifications.tsx` (ny)

- Tilgængelig fra ComplianceOverview som et 4. kort eller en fane på Admin-siden
- Viser en liste af nuværende modtagere (navn + email fra employee_master_data)
- Dropdown/søgefelt til at tilføje nye modtagere (fra aktive medarbejdere)
- Mulighed for at fjerne modtagere
- Kun synlig for brugere med `menu_compliance_admin` permission

### 4. Route + navigation

- Tilføj route `/compliance/notifications` i App.tsx
- Tilføj kort i ComplianceOverview med titel "Notifikationsmodtagere" (Bell-ikon, Admin badge)

### 5. Edge Function: `check-compliance-reviews` (ugentlig)

- Finder GDPR-relaterede deadlines/hændelser der kræver opmærksomhed (fx samtykker der nærmer sig udløb, afventende datanmodninger osv.)
- Slår modtagere op fra `compliance_notification_recipients` (i stedet for hardcoded)
- Sender email via M365 Graph API
- Ugentligt cron-job (mandag kl. 08:00): `0 8 * * 1`

### Filer

| Fil | Handling |
|-----|---------|
| `src/pages/compliance/AdminDocumentation.tsx` | Opdater `[dato]` → `28.03.2026` |
| `src/pages/compliance/ComplianceNotifications.tsx` | Ny side: administrer modtagere |
| `src/pages/compliance/ComplianceOverview.tsx` | Tilføj kort til notifikationer |
| Migration | Opret `compliance_notification_recipients` tabel |
| `supabase/functions/check-compliance-reviews/index.ts` | Ny Edge Function |
| SQL insert (cron) | Ugentligt cron-job |
| App.tsx | Tilføj route |

