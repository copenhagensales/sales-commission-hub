

## Implementer 3 GDPR-forbedringer

### 1. Log samtykketekst ved accept
Tilføj en `consent_text` kolonne til `gdpr_consents`-tabellen og gem den præcise samtykketekst, som medarbejderen accepterede, ved hvert samtykke.

**Database**: Migration der tilføjer `consent_text text` kolonne til `gdpr_consents`.

**Kode**:
- `src/components/gdpr/GdprConsentDialog.tsx`: Definer samtykketeksten som en konstant, send den med til `useGiveConsent`.
- `src/hooks/useGdpr.ts`: Udvid `useGiveConsent` til at modtage og gemme `consentText` i insert.

### 2. DPIA-dokumentationsside
Ny statisk compliance-side der dokumenterer konsekvensanalyser for højrisiko-behandlinger (CPR, løn, bankdata).

**Filer**:
- `src/pages/compliance/DpiaDocumentation.tsx` — Ny side med DPIA for relevante behandlingsaktiviteter (CPR-behandling, lønudregning, rekruttering). Indeholder risikovurdering, foranstaltninger og konklusion.
- `src/routes/pages.ts` — Tilføj lazy import.
- `src/routes/config.tsx` — Tilføj route `/compliance/dpia` med `menu_compliance_admin` permission.
- `src/pages/compliance/ComplianceOverview.tsx` — Tilføj DPIA-kort til cards-arrayet.

### 3. Medarbejder-awareness dokumentation
Ny compliance-side der dokumenterer hvornår medarbejdere er blevet informeret om GDPR og datahåndtering.

**Filer**:
- `src/pages/compliance/GdprAwareness.tsx` — Ny side med oversigt over awareness-aktiviteter: onboarding-gennemgang, Code of Conduct quiz (allerede i systemet), løbende påmindelser. Viser at medarbejdere accepterer GDPR ved login (consent dialog) og gennemfører Code of Conduct quiz.
- `src/routes/pages.ts` — Tilføj lazy import.
- `src/routes/config.tsx` — Tilføj route `/compliance/awareness` med `menu_compliance_admin` permission.
- `src/pages/compliance/ComplianceOverview.tsx` — Tilføj awareness-kort til cards-arrayet.

### Fil-oversigt
| Fil | Ændring |
|-----|---------|
| `gdpr_consents` tabel | Migration: tilføj `consent_text text` |
| `src/hooks/useGdpr.ts` | Gem `consentText` ved insert |
| `src/components/gdpr/GdprConsentDialog.tsx` | Send samtykketekst med |
| `src/pages/compliance/DpiaDocumentation.tsx` | **Ny** — DPIA-side |
| `src/pages/compliance/GdprAwareness.tsx` | **Ny** — Awareness-side |
| `src/routes/pages.ts` | 2 nye lazy imports |
| `src/routes/config.tsx` | 2 nye routes |
| `src/pages/compliance/ComplianceOverview.tsx` | 2 nye kort |

