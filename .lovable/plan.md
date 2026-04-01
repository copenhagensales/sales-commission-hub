

## Send email-notifikation ved nye system-indrapporteringer

### Problem
Når en bruger indsender en ny indrapportering på `/system-feedback`, gemmes den i `system_feedback`-tabellen, men der sendes ingen email-notifikation. Administratorer opdager derfor ikke nye indrapporteringer medmindre de selv tjekker siden.

### Løsning
Opret en ny edge function `notify-system-feedback` der sender en notifikationsmail via M365 (samme mønster som `customer-inquiry-webhook` og `check-compliance-reviews` bruger). Kald funktionen fra `SystemFeedback.tsx` efter succesfuld insert.

### Ændringer

**1. Ny edge function: `supabase/functions/notify-system-feedback/index.ts`**
- Modtager feedback-data (titel, kategori, prioritet, beskrivelse, berørt medarbejder, system-område, indsendt af)
- Henter M365 access token via client credentials (genbruger eksisterende M365-env vars)
- Sender en formateret HTML-email til en fast modtagergruppe (f.eks. mg@copenhagensales.dk og km@copenhagensales.dk — samme som customer-inquiry)
- Email indeholder alle relevante felter i en tabel-layout

**2. Tilføj til `supabase/config.toml`**
```
[functions.notify-system-feedback]
verify_jwt = false
```

**3. Opdater `src/pages/SystemFeedback.tsx`**
- I `submitMutation.onSuccess`: kald `supabase.functions.invoke("notify-system-feedback", { body: { title, category, priority, description, affectedEmployee, systemArea } })` (fire-and-forget, fejl blokerer ikke brugeren)

### Modtagere
Samme modtagere som kundehenvendelser: mg@copenhagensales.dk og km@copenhagensales.dk. Vil du have andre/flere modtagere?

