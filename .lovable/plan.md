
Ja.

Det jeg kan se i koden og live-data er:

### Hvad der sker lige nu
1. `booking_confirmation_sms` sendes korrekt ved rigtig booking i `public-book-candidate`.
2. Men der lå stadig gamle allerede-oprettede touchpoints i `booking_flow_touchpoints` med `template_key = 'booking_confirmation_sms'`.
3. `process-booking-flow` sendte dem kl. `19:35`, selvom de aldrig burde have været oprettet som del af første outreach.

### Bevis
- I databasen står `booking_confirmation_sms` nu korrekt som:
  - `phase = confirmation`
- Men der findes stadig 2 udsendte touchpoints med:
  - `template_key = booking_confirmation_sms`
  - `status = sent`
- `process-booking-flow` log viser:
  - `Found 2 pending touchpoints`
  - `Done. Processed: 2`
- `public-book-candidate` log viser bagefter:
  - `Confirmation SMS sent to Kasper`

### Svar på dit spørgsmål
- Ja, du fik ved en fejl en booking-bekræftelse sammen med første flow-SMS.
- Ja, du får den igen “rigtigt”, når du faktisk booker tid, fordi den rigtige booking-logik stadig kører separat.

### Hvorfor det sker
Fixet stoppede nye fejl fremadrettet i logikken for nye flow-oprettelser, men det fjernede ikke de gamle pending touchpoints, som allerede var blevet oprettet før rettelsen.

### Hvad der bør gøres
Hvis vi skal rydde det helt op, bør næste rettelse være:

1. Rydde eksisterende `booking_confirmation_sms`-touchpoints væk fra outreach-data
   - enten slette dem
   - eller markere dem som `cancelled`

2. Gennemgå om der findes flere historiske fejl-touchpoints med samme mønster

3. Eventuelt lave en sikkerhedsregel i `process-booking-flow`, så den aldrig sender `confirmation`-templates fra touchpoints, hvis sådan nogle mod forventning findes igen

### Konsekvens
Når de gamle fejl-touchpoints er ryddet op:
- første SMS bliver kun den rigtige dag-0-besked
- booking-bekræftelsen sendes kun ved reel booking
- kandidaten får ikke dobbelt “bekræftelse”

### Konkret implementeringsplan
- Lav en database-migration der finder `booking_flow_touchpoints` med `template_key = 'booking_confirmation_sms'` og som ikke stammer fra reel booking, og markerer dem som `cancelled`
- Tilføj en ekstra guard i `process-booking-flow`, så system-trigger templates som `booking_confirmation_sms` aldrig udsendes fra det almindelige outreach-loop
- Verificér bagefter i logs og databasen, at:
  - der er 0 pending `booking_confirmation_sms` touchpoints
  - kun `public-book-candidate` sender confirmation-SMS ved booking
