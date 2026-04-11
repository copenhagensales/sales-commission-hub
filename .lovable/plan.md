

## Opret "Tak for ansøgning" email-skabelon

### Hvad der sker
Tilføjer en ny system-skabelon "Bekræftelse af ansøgning" til email-skabelonerne, som automatisk sender en bekræftelse til kandidater når de søger. Skabelonen oprettes som en ny system-template (ligesom invitation/afslag/jobtilbud) men aktiveres ikke — den er bare klar til brug.

### Indhold af skabelonen
- **Emne:** "Tak for din ansøgning hos Copenhagen Sales"
- **Tone:** Professionel, varm, Pipeline-inspireret (clean, premium SaaS-feel)
- **Variabler:** `{{fornavn}}`, `{{rolle}}`
- **Indhold:** Kort bekræftelse, hvad der sker nu (vi gennemgår ansøgningen), forventet responstid, Copenhagen Sales signatur

### Teknisk plan
**Fil:** `src/pages/recruitment/EmailTemplates.tsx`

1. Tilføj en ny default-tekst konstant `DEFAULT_APPLICATION_CONFIRMATION` med den Pipeline-inspirerede bekræftelsesmail
2. Tilføj en ny entry i `TEMPLATE_CONFIGS` arrayet:
   - `key: "bekraeftelse_ansoegning"`
   - `name: "Bekræftelse af ansøgning"`
   - `icon: Mail` (eller `Send`)
   - Badge og preview-data
3. Opdater `TemplateKey` typen til at inkludere den nye nøgle

Skabelonen vil dukke op som en ny tab i email-skabeloner, klar til redigering og test — men ikke koblet til nogen automatisk sending.

