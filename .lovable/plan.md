

## Påmindelse om ufærdige kladder

### Idé
Udvid den eksisterende `PulseSurveyPopup` så den også tjekker om medarbejderen har en gemt kladde. Hvis ja, vises en tilpasset besked der nævner at de har en igangværende besvarelse — i stedet for den generiske "din pulsmåling er klar"-tekst.

### Ændringer

**1. Ny hook: `usePulseSurveyHasDraft(surveyId)`** i `src/hooks/usePulseSurvey.ts`
- Simpel query der checker om der findes en kladde for den aktuelle medarbejder + survey
- Returnerer `boolean`

**2. Opdater `PulseSurveyPopup.tsx`**
- Kald `usePulseSurveyHasDraft` for at vide om der er en kladde
- Hvis kladde findes: vis en anden tekst, fx:
  - Titel: *"Du har en igangværende pulsmåling"*
  - Beskrivelse: *"Du er allerede i gang — det tager kun et par minutter at gøre den færdig."*
  - Knaptekst: *"Fortsæt besvarelse"* i stedet for *"Besvar nu"*
- Popuppen vises også selvom den tidligere er dismissed (da dismiss kun gælder "ny survey"-påmindelsen — vi tilføjer en separat dismiss-logik for kladde-påmindelsen, eller genbruger den eksisterende med en kortere cooldown)
- Alternativt: Ignorer dismiss helt for kladde-påmindelser, så medarbejderen altid mindes om det

### Tekniske detaljer
- Hooket kalder `pulse_survey_drafts` med `.select('id').eq('survey_id', surveyId).eq('employee_id', ...)` og checker om data returneres
- Ingen nye tabeller nødvendige — bruger den eksisterende `pulse_survey_drafts`
- Popuppen prioriterer kladde-besked over standard-besked (hvis kladde → vis kladde-variant, ellers standard)

