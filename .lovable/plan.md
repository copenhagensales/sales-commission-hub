

## Fuld GDPR-compliance: 5 tilføjelser

### 1. Database: `security_incidents` tabel
Ny tabel til registrering af sikkerhedsbrud (Artikel 33-krav). Felter: dato, beskrivelse, berørte kategorier, antal berørte, indberettet til Datatilsynet (boolean + dato), afhjælpende foranstaltninger, status, oprettet af. RLS: kun synlig for owner/admin.

### 2. Artikel 30-fortegnelse (behandlingsaktiviteter)
Ny side `src/pages/compliance/ProcessingActivities.tsx` med statisk indhold der dokumenterer alle behandlingsaktiviteter:
- Formål, retsgrundlag (GDPR art. 6), personkategorier, datatyper, modtagere, slettefrister, sikkerhedsforanstaltninger
- Dækker: Løn/provision, rekruttering, vagtplan, salg, coaching, AMO, tidsstemplinger osv.

### 3. Sikkerhedsbrud-log (Breach log)
Ny side `src/pages/compliance/SecurityIncidents.tsx`:
- Formularer til registrering af nye hændelser
- Tabel med historik, status-badges, filtrering
- Kun admin/owner adgang

### 4. Samtykke-tilbagetrækning
Opdater `GdprSettingsCard.tsx` med "Tilbagetræk samtykke"-knap der sætter `revoked_at = now()` på aktive consents.
Tilføj `useRevokeConsent` hook i `useGdpr.ts`.

### 5. Ansøgerdata-cleanup i edge function
Udvid `gdpr-data-cleanup/index.ts` til at anonymisere kandidatdata (recruitment_candidates) ældre end 6 måneder efter afslag/afvisning.

### Filer og ændringer

| Fil | Handling |
|---|---|
| Database migration | Ny `security_incidents` tabel med RLS |
| `src/pages/compliance/ProcessingActivities.tsx` | Ny side – Artikel 30 fortegnelse |
| `src/pages/compliance/SecurityIncidents.tsx` | Ny side – Brudlog |
| `src/hooks/useGdpr.ts` | Tilføj `useRevokeConsent` hook |
| `src/hooks/useSecurityIncidents.ts` | Ny hook til CRUD på security_incidents |
| `src/components/gdpr/GdprSettingsCard.tsx` | Tilføj tilbagetræk-samtykke knap |
| `supabase/functions/gdpr-data-cleanup/index.ts` | Udvid med kandidat-cleanup |
| `src/routes/pages.ts` | Tilføj lazy imports for nye sider |
| `src/routes/config.tsx` | Tilføj routes med permission-guard |
| `src/pages/compliance/ComplianceOverview.tsx` | Tilføj kort til nye sider |

