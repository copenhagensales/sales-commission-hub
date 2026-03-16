

## Gør team-valg obligatorisk i pulsmålingen

### Problem
Selvom der er en validering ved submit (linje 201), er `selectedTeamId` markeret som **optional** i hooket (`selectedTeamId?: string`), og der er ingen visuel indikation af at feltet er påkrævet. 68 af 71 besvarelser mangler team-tilknytning.

### Ændringer

**1. `src/hooks/usePulseSurvey.ts`** — Gør `selectedTeamId` required
- Ændr `selectedTeamId?: string` til `selectedTeamId: string` (linje 109)
- Tilføj tidlig fejl: `if (!selectedTeamId) throw new Error('Team selection is required')`

**2. `src/pages/PulseSurvey.tsx`** — Visuel blokering + required-markering
- Tilføj rød asterisk (`*`) ved team-dropdown label
- Vis inline fejlbesked under dropdown hvis man forsøger at submitte uden team
- Disable submit-knappen når `!selectedTeamId` (supplerende til eksisterende toast-validering)

**3. `src/pages/PublicPulseSurvey.tsx`** — Samme ændringer
- Rød asterisk ved team-label
- Disable submit-knappen når `!selectedTeamId`
- Inline fejlbesked ved manglende team

**4. `supabase/functions/submit-pulse-survey/index.ts`** — Backend-validering
- Tilføj `submitted_team_id` som required felt i valideringen (linje 53-57)
- Returnér 400 hvis `submitted_team_id` mangler

### Resultat
Team-valg bliver obligatorisk i alle tre lag: UI (disabled knap + markering), frontend-validering (toast), og backend-validering (400-fejl). Ingen besvarelse kan indsendes uden team fremover.

