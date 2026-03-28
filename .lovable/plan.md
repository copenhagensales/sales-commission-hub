

## Plan: AI Compliance-sektion i systemet

Bygger en ny side `/compliance/ai-governance` der følger samme mønster som de eksisterende compliance-sider (SecurityIncidents, ProcessingActivities, GdprAwareness), med database-backed register, rolleudpegning og instruktionslog.

### Hvad der bygges

**1. Ny side: `AiGovernance.tsx`** med fire faner (Tabs):

- **Politik** — Dokumentets sektioner (2.1-2.10) i accordions: Formål, Omfang, Godkendte systemer, Tilladt/Ikke-tilladt brug, Dataregler, Menneskelig kontrol, Ansvar, Træning, Revision. Plus brugerinstruksen (Do/Don't-tabel fra sektion 3).

- **Ansvarsfordeling** — Tabel med de 4 roller (AI-ansvarlig, Systemejer ChatGPT, Systemejer Lovable, Nærmeste leder). Forudfyldt med Kasper Mikkelsen. Admin kan redigere hvem der er udpeget. Data fra `ai_governance_roles`-tabel.

- **AI-register** — CRUD-tabel (som SecurityIncidents) med use cases. Felter: navn, system, ejer, brugere, datatyper, persondata (ja/nej), risikoniveau, menneskelig kontrol, godkendelsesdato, næste review. Forudfyldt med de 2 kendte use cases (ChatGPT tekstudkast + Lovable interne systemer). Data fra `ai_use_case_registry`-tabel.

- **Instruktionslog** — Tabel med hvem der har modtaget AI-instruktion: medarbejder, dato, metode (email/manuelt), kvittering. "Send AI-instruktion"-knap der kalder edge function → sender mail via M365 til valgte modtagere og logger det. Data fra `ai_instruction_log`-tabel.

**2. Database — 3 nye tabeller:**

```sql
-- Roller i AI-styring
ai_governance_roles (id, role_name, responsible_person, appointed_by, status, notes, created_at, updated_at)

-- AI use case register (Art. 4)
ai_use_case_registry (id, name, system, owner, user_group, data_types, has_personal_data, risk_level, human_control_requirement, approved_date, next_review_date, notes, created_at, updated_at)

-- Instruktionslog (dokumentation for Art. 4 AI literacy)
ai_instruction_log (id, employee_id ref agents, instruction_date, method, acknowledged, notes, created_at)
```

RLS: Authenticated users kan SELECT. Kun admin/ejer kan INSERT/UPDATE/DELETE.

**3. Edge function: `send-ai-instruction-email`**
- Modtager liste af employee_ids
- Henter emails fra agents-tabellen
- Sender branded HTML-mail via M365 Graph API (samme mønster som `check-compliance-reviews`)
- Indhold: Godkendte værktøjer, tilladt/ikke-tilladt brug, dataregler, link til compliance-siden
- Logger hver modtager i `ai_instruction_log`

**4. Forudfyldte data (via migration INSERT):**
- 4 governance-roller med Kasper Mikkelsen
- 2 use cases (ChatGPT Business + Lovable)

**5. Route + navigation:**
- Tilføj lazy export i `pages.ts`
- Tilføj route i `config.tsx` med `menu_compliance_admin`
- Tilføj kort på ComplianceOverview med `Brain`-ikon og "EU AI Act"-badge

### Filer

| Fil | Handling |
|-----|---------|
| `src/pages/compliance/AiGovernance.tsx` | Ny |
| `supabase/functions/send-ai-instruction-email/index.ts` | Ny |
| `src/pages/compliance/ComplianceOverview.tsx` | Tilføj kort |
| `src/routes/pages.ts` | Tilføj export |
| `src/routes/config.tsx` | Tilføj route |
| DB migration | 3 tabeller + seed data |

