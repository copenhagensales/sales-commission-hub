

# Forbedret kontraktvisning – Layout redesign

## Nuværende problemer (fra screenshot)
- Papir-containeren er indlejret i flere lag af cards/shadows, hvilket giver et "boks-i-boks" udseende
- For meget vertikal padding og whitespace omkring kontraktindholdet
- Progress stepperen og metadata-grid tager meget plads før selve kontrakten
- Den venstre accent-border (grøn linje) virker malplaceret
- Overordnet føles layoutet tungt med mange nested containers

## Foreslåede forbedringer

### 1. Simplificér header-området
- Flyt metadata (udsendt, status, type, afsender) ind i den sticky header som kompakt info
- Fjern det separate header-card med `bg-primary/5` — lad kontrakten starte direkte
- Behold progress stepper men gør den mere kompakt

### 2. Renere papir-container
- Fjern den ydre card-wrapper og accent-border
- Lad papir-containeren stå direkte på baggrunden med en subtil skygge
- Øg bredden en smule for bedre læsbarhed (max-w-3xl i stedet for max-w-[42rem])

### 3. Bedre visuelt hierarki
- Kontrakttitel som del af papir-dokumentet (ikke i en separat header-card)
- Mere luft i selve prose-indholdet men mindre wrapper-padding
- Renere typografi med bedre spacing

### 4. Sticky header polish
- Mere kompakt og elegant sticky bar
- Vis kontrakttitlen i headeren når man scroller

## Tekniske ændringer
- Kun `src/pages/ContractSign.tsx` ændres
- Refaktorér layout fra linje ~362-540 (header card + contract content)
- Behold al funktionalitet (scroll tracking, stepper, sign section)

