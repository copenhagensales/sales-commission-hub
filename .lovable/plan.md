

## Tillad tidligere datoer for flytning + korrekt datahåndtering

### Problem
Kalenderen i "Flyt medarbejder"-dialogen blokerer alle datoer før i dag (`date < startOfDay(new Date())`). Brugeren skal kunne vælge tidligere datoer for at registrere flytninger med tilbagevirkende kraft.

### Løsning

**Fil:** `src/components/employees/TeamsTab.tsx`

1. **Fjern datobegrænsningen** på kalenderen (linje 1028):
   - Fjern `disabled={(date) => date < startOfDay(new Date())}` så alle datoer kan vælges

2. **Behandl tidligere datoer som øjeblikkelige flytninger:**
   - I mutationen (`moveEmployeeToTeamMutation`): udvid `isTodayMove`-checket til også at inkludere datoer i fortiden
   - Ændre logik: `const isImmediateMove = isToday(effectiveDate) || effectiveDate < new Date()`
   - Tidligere datoer udfører flytningen med det samme (ligesom "i dag"), da de allerede skulle have været gennemført

3. **Opdater UI-feedback:**
   - Tilføj en besked for tidligere datoer: "Medarbejderen flyttes øjeblikkeligt (tilbagevirkende kraft)"
   - Behold eksisterende beskeder for i dag og fremtidige datoer

### Teknisk opsummering
- 1 fil ændres: `src/components/employees/TeamsTab.tsx`
- Kalenderen tillader alle datoer
- Tidligere datoer → øjeblikkelig flytning (som i dag)
- Fremtidige datoer → planlagt flytning via `scheduled_team_changes` (uændret)

