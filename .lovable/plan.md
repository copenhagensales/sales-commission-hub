
Mest sandsynlige årsag er nu ikke længere selve gemningen, men frontend-logikken omkring lås/pop-up:

1. `usePulseSurveyLock` starter sin query når `hasCompleted` stadig er `undefined`, fordi den bruger `!hasCompleted`.
2. Hvis låsen når at blive beregnet som `true`, bliver den hængende i query-cachen, også når completion senere bliver `true`.
3. `PulseSurveyPopup` har samme mønster: den bruger `!hasCompleted` i stedet for en eksplicit `hasCompleted === false` og venter ikke på completion-loading.
4. Jeg kan også se, at den aktive april-survey stadig har mismatch i data (`53 responses` vs `51 completions`), så der er stadig nogle historiske/manglende completion-records som skal heales.

Plan:
1. Stram al pulse-survey gating i frontend
   - Ret `usePulseSurveyLock` til kun at køre når `hasCompleted === false` og `completionLoading === false`
   - Returnér altid `false` når query er disabled eller completion er sand
   - Undgå at gammel lock-state bliver genbrugt fra cache

2. Ret popup-logikken
   - Få `PulseSurveyPopup` til eksplicit at vente på completion-check før den må åbne
   - Brug `hasCompleted === false` i stedet for `!hasCompleted`
   - Samme stramme check i badge/menu- og overlay-flowet

3. Gennemfør en defensiv frontend-synkronisering efter submit/login
   - Ved submit: skriv completion optimistisk og nulstil lock/popup-relaterede queries
   - Ved login/app-load: tving refetch af completion før lock/popup må afgøres

4. Heal de manglende april-records
   - Kør en migration eller backend-healing for de aktuelle besvarelser uden completion
   - Gennemgå dubletterne fra 15. april separat, så systemet ikke fejltolker dem

5. Tilføj midlertidig diagnostik
   - Log ét samlet state-billede for survey-flowet: `surveyId`, `userId`, `hasCompleted`, `completionLoading`, `lockEnabled`, `lockState`, `popupEligible`
   - Det gør det muligt at verificere, at loopet er stoppet for sælgerne

Teknisk fokus:
- `src/hooks/usePulseSurvey.ts`
- `src/hooks/usePulseSurveyLock.ts`
- `src/components/pulse/PulseSurveyPopup.tsx`
- evt. en ny migration til healing af manglende `pulse_survey_completions`

Forventet effekt:
- Brugere der allerede har svaret bliver ikke låst eller bedt om at svare igen mens completion-check stadig loader
- Stale lock-state forsvinder
- De sidste manglende april-completions bliver ryddet op, så gamle fejl ikke fortsætter med at trigge loopet
