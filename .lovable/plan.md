

## Nulstil marts-pulsmålingen og genudsend med undskyldning

### Hvad skal ske

**1. Slet eksisterende data for marts-surveyet (database-operationer)**
- Slet alle rækker i `pulse_survey_responses` for marts-surveyet
- Slet alle rækker i `pulse_survey_completions` for marts-surveyet
- Slet alle rækker i `pulse_survey_dismissals` for marts-surveyet
- Slet alle rækker i `pulse_survey_drafts` for marts-surveyet

Dette sikrer at alle medarbejdere ser popup'en igen og kan besvare på ny.

**2. Opdater popup-beskeden (`PulseSurveyPopup.tsx`)**

Tilføj en tredje variant af titlen og beskrivelsen der vises for marts-surveyet (eller generelt som en midlertidig besked):

- **Titel**: "Din pulsmåling skal besvares igen"
- **Beskrivelse**: "Vi beklager ulejligheden — din tidligere besvarelse blev desværre ikke registreret korrekt, og vi har derfor brug for, at du besvarer pulsmålingen igen. Det tager kun 2 minutter, og dine svar er fortsat 100% anonyme."

Denne besked vises i stedet for den normale velkomstbesked, når der hverken er en draft (dvs. det er en "genbesvarelse"-situation). Implementeres som en midlertidig tekst i popup-komponenten.

**3. Tilføj en banner-besked øverst i selve survey-siden (`PulseSurvey.tsx` + `PublicPulseSurvey.tsx`)**

En Alert-komponent øverst i formularen:
> "Vi beklager – din tidligere besvarelse blev desværre ikke registreret korrekt. Vi har derfor brug for, at du besvarer pulsmålingen igen. Tak for din forståelse."

### Teknisk opsummering
- **4 DELETE-operationer** via insert-tool mod de 4 tabeller, filtreret på mars-surveyets ID
- **1 fil-ændring**: `PulseSurveyPopup.tsx` — opdater description-tekst
- **2 fil-ændringer**: `PulseSurvey.tsx` + `PublicPulseSurvey.tsx` — tilføj Alert-banner

