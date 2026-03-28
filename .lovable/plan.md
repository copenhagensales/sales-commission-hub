

## Udfyld compliance-dokumentation med konkrete oplysninger

Opdaterer alle sektioner i `AdminDocumentation.tsx` fra generiske lister til faktiske, udfyldte oplysninger baseret på dine svar og systemets faktiske opsætning.

### Ændringer per sektion

**1. Tredjelandsoverførsler**
- Erstat den generiske liste med en klar konklusion: "Ingen tredjelandsoverførsler. Alle data behandles og opbevares inden for EU/EØS." med grøn badge.

**2. Logging og dokumentation**
- Udfyld med konkrete eksempler fra systemet: login-logning, kontraktændringer, salgsdata-sync, lønberegninger, GDPR-anmodninger. Tilføj at logs opbevares i databasen.

**3. Backup og gendannelse**
- Udfyld med Lovable Cloud's automatiske backup (daglig, administreret af platformen). Angiv at restore håndteres via Lovable Cloud support.

**4. Sletning og retention**
- Konkret politik baseret på dit svar:
  - Økonomi-/løndata: 5 år (bogføringsloven)
  - Medarbejderdata: slettes efter fratræden, senest 5 år
  - Samtykker: opbevares så længe de er aktive
  - Salgsdata: 5 år
  - Sletning: primært manuel med mulighed for automatisering

**5. AI-brug**
- Dokumenter de faktiske AI-funktioner i systemet:
  - FM Profit Agent (Google Gemini) — analyse af salgsdata
  - Udgiftsformel-parsing (Google Gemini) — tolkning af provisionsformler
  - Lovable AI Gateway — ingen persondata sendes direkte; data aggregeres først
  - Risici og begrænsninger dokumenteres

**6. Ansvar**
- Udfyld med: "Systemejeren (virksomhedens ejer) er dataansvarlig jf. GDPR art. 4, nr. 7." samt konkrete ansvarsområder.

### Fil
| Fil | Handling |
|-----|---------|
| `src/pages/compliance/AdminDocumentation.tsx` | Opdater alle 6 sektioner med konkret indhold |

