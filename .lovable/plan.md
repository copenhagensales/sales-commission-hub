
## Problem
Skærmbilledet bekræfter symptomet: Alexander står med `-0 kr.` i “Annulleringer”, selv om hans godkendte annulleringer ligger i perioden 15/2–14/3.

## Root cause
Fejlen ligger i `src/hooks/useSellerSalariesCached.ts`.

Provision bliver beregnet via den centrale salgsaggregering, som kan mappe en sælger via:
- `employee_agent_mapping`, eller
- fallback til `work_email`

Men annulleringer i samme hook bliver kun mappet sådan her:
- `sales.agent_email` -> `employee_master_data.work_email`

Det virker ikke for Alexander, fordi hans annulleringer ligger på agent-emailen `algc1@...`, mens hans `work_email` er `algc@...`. Han er korrekt koblet via `employee_agent_mapping`, men den mapping bliver slet ikke brugt i annulleringsdelen.

## Plan
1. Opdatér `useSellerSalariesCached.ts` så hooket også henter `employee_agent_mapping` med tilhørende agent-email.
2. Byg et fælles `emailToEmployeeId` lookup, som inkluderer:
   - `work_email`
   - alle mapped agent-emails fra `employee_agent_mapping`
3. Brug det fælles lookup både til annulleringer og øvrige email-baserede opslag i hooket.
4. Behold den eksisterende annulleringslogik for `target_product_name` og `basket_difference`; vi ændrer kun medarbejder-resolveren.
5. Verificér at Alexander nu får sine annulleringer med i perioden 15/2–14/3, og at andre sælgere stadig vises korrekt.

## Berørte filer
- `src/hooks/useSellerSalariesCached.ts`

## Forventet resultat
Alexander bliver korrekt identificeret via `employee_agent_mapping`, så hans godkendte annulleringer bliver samlet op og vist i kolonnen “Annulleringer” i lønoversigten.

## Tekniske detaljer
- Ingen databaseændringer er nødvendige.
- Den sikreste løsning er at følge samme mappingsprincip som den centrale salgsaggregering, så provision og annulleringer bruger samme identitetslogik.
- Den konkrete forskel i data er:
  - medarbejderens `work_email`: `algc@...`
  - annulleringernes `sales.agent_email`: `algc1@...`
  - mapping findes allerede i `employee_agent_mapping`, men ignoreres i nuværende hook.
