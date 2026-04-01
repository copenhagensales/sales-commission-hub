

## Fix: Email-notifikationer for indrapporteringer og statusændringer

### Problem
Ingen emails sendes, hverken når nye indrapporteringer oprettes eller når status ændres. Edge function logs er tomme for begge funktioner, hvilket tyder på at de ikke er korrekt deployed.

### Årsager fundet
1. **`notify-feedback-status-change` mangler i `config.toml`** — den er ikke registreret, så den kan ikke invokes
2. **Begge funktioner har nul logs** — de skal gendeployes
3. **`submittedBy` sendes ikke med** i notify-system-feedback kaldet (kosmetisk, men bør fixes)

### Ændringer

**Fil: `supabase/config.toml`**
- Tilføj `notify-feedback-status-change` med `verify_jwt = false`

**Fil: `src/pages/SystemFeedback.tsx`**
- Tilføj `submittedBy` (medarbejderens navn) til notify-system-feedback body, så admin-mailen viser hvem der indsendte

**Deploy**
- Gendeployér begge edge functions: `notify-system-feedback` og `notify-feedback-status-change`

### Tekniske detaljer
- Edge functions bruger M365 Graph API med client credentials — kræver at `M365_TENANT_ID`, `M365_CLIENT_ID`, `M365_CLIENT_SECRET`, `M365_SENDER_EMAIL` secrets er sat op (disse bruges allerede af andre funktioner, så de burde være på plads)
- `notify-system-feedback` sender til hardcodede modtagere (mg@ og km@copenhagensales.dk)
- `notify-feedback-status-change` sender til den medarbejder der oprettede indrapporteringen

