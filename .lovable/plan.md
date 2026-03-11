
Mål:
Få beløbsfelterne i kontrakt-dialogen til at formatere med dansk tusindtalsseparator under indtastning, og vise fejl hvis værdierne overskrider de ønskede grænser.

Plan:
1. Gennemgå `SendContractDialog.tsx` og samle al logik for beløbsinput i små hjælpefunktioner:
   - rense input til kun cifre
   - formatere som dansk tal med punktum som tusindtalsseparator
   - konvertere tilbage til råt tal til merge tags og preview
2. Skifte relevante beløbsfelter fra `type="number"` til tekstfelt med numerisk tastatur, så formatering som `25.000` kan vises mens man skriver.
3. Tilføje validering for de viste kontraktfelter:
   - Timeløn: maks. 3 cifre
   - Øvrige beløbsfelter i dialogen: maks. 5 cifre
   - ved overskridelse vises tydelig fejltekst under feltet
4. Blokere afsendelse hvis et beløbsfelt er ugyldigt, og vise en samlet fejlbesked så brugeren ved hvorfor kontrakten ikke kan sendes.
5. Sørge for at preview, merge tags og gemt kontraktindhold stadig bruger de numeriske værdier korrekt formateret som DKK.

Berørte felter:
- `Teamleder -> Minimumsløn`
- `Assisterende teamleder -> Timeløn`
- `Assisterende teamleder -> Månedsløn`

Tekniske detaljer:
- Den nuværende brug af `type="number"` skal ændres, ellers kan feltet ikke vise `.` som tusindtalsseparator under skrivning.
- Jeg vil sandsynligvis indføre en lille formatterings-helper direkte i komponenten eller genbruge eksisterende formatteringsmønstre, så både inputfelter og merge-output bruger samme logik.
- Valideringen laves klient-side i dialogen med tydelige fejlbeskeder og ekstra guard før submit.
- Bonus og Team forbliver tekstfelter uden denne beløbsvalidering.

Resultat:
Brugeren kan skrive fx `25000`, feltet vises som `25.000`, og hvis der skrives for mange cifre vises en fejl med det samme. Timeløn afvises over 3 cifre.
