# Opstart: dine egne minimumsforventninger i grafen

## Hvad du får
1. **Ny lille fane "Minimumskrav"** på Opstart-siden. Kun ejere kan se og ændre den. Her står ét tal pr. opstartsuge, udfyldt fra start med:
   - Uge 1: 5 salg
   - Uge 2: 8 salg
   - Uge 3: 11 salg
   - Uge 4: 14 salg
   - Uge 5 og frem: 17 salg pr. uge

   Tallene kan ændres og gemmes. Ændringen slår igennem for alle med det samme.
2. **Kravet fordeles på dagene.** Sælgerens egen arbejdsdag regnes fra deres startdato. Med 5 salg i uge 1 skal man have 1 salg efter første dag, 2 efter anden dag osv. Det følger med hver dag.
3. **Ny streg i grafen:** "Minimum (dit krav)" vises som en tydelig stiplet streg sammen med de streger, der er i dag ("Normal" og "Typisk spænd"). Man kan se med det samme, om en sælger ligger over eller under dit minimum. Hver sælgers oplysninger ved musen viser også "x salg · minimum y i dag".
4. **Uændret:** Grupperne Start her, Hold fast og På sporet, alarmerne og mails til lederne bruger fortsat opstartskurven som i dag. Vil du senere have, at dit minimum styrer grupperne, er det en særskilt beslutning.

## Afgrænsning
Der ændres ikke i løn, provision, beregningen af kurven, logikken for fareflag eller hvem der kan se siden.

## Tekniske detaljer
- Migration: ny kolonne `ramp_settings.weekly_min_targets jsonb` med default `[5,8,11,14,17]`. Det sidste tal gælder for alle uger derefter. Kun ejer/superadmin må opdatere den, via en SECURITY DEFINER RPC `set_ramp_weekly_min_targets` med adgangstjek og validering (heltal ≥ 0).
- Delt ren funktion `src/lib/rampMinTarget.ts` med `minCumulativeAt(day, targets)`. Uge = `ceil(day/5)`. Hver uge bidrager med `target/5` pr. arbejdsdag og summeres kumulativt. Funktionen får en `.test.ts`.
- Grafen viser i dag salg som forhold til medianen (`cum_sales / p50`). Minimumsstregen tegnes som `minCumulativeAt(d) / p50(d)` pr. dag og bruger opstartskurvens p50 fra den eksisterende kurve-hook. Den tegnes som en trappe-/kurvelinje.
- Hook `useRampMinTargets` (React Query, invalidering ved gem). Editoren ligger i `RampTeam.tsx`, og stregen i `RampOverviewMatrix.tsx`.
