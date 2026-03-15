

## Ændring af spørgsmål 1 i pulsmålingen

**Fil:** `src/pages/PulseSurvey.tsx`

Ændringer i `SCALE_QUESTIONS[0]`:
- **question**: "Hvor sandsynligt er det, at du vil anbefale Copenhagen Sales som arbejdsplads, hvis nogen spørger dig?"
- **helpText** (skala-forklaring): "0 = Slet ikke sandsynligt, 10 = Meget sandsynligt" — beholdes som i dag
- **Ny ekstra hjælpetekst** under helpText: "Tænk på, hvor tryg du ville være ved at anbefale Copenhagen Sales som arbejdsplads - ikke på om du konkret har nogen i dit netværk, du ville anbefale os til."

Den ekstra hjælpetekst vises som en ekstra `<p>` under den eksisterende helpText i NPS-kortet.

