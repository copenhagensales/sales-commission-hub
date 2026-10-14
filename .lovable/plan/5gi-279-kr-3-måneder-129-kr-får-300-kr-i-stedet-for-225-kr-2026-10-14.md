# 5GI 279 kr. (3 måneder 129 kr.) får 300 kr. i stedet for 225 kr.

## Konklusion
Du har ret i, at det er reglerne på "5GI MBB", der giver 225 kr. Salget i dagsrapporten lander dog ikke på "5GI MBB". Det lander på produktet "5GI - 279 kr. (3 måneder 129 kr) (6 mdr. binding)".

Det produkt er lagt sammen med "5GI MBB", men har selv ingen regler. Derfor falder salget tilbage på produktets grundsats på 300 kr.

## Det har jeg fundet (kun læst, intet er ændret)
- "5GI - 279 kr. (3 måneder 129 kr)" har produktkode 9461. Det er markeret som lagt sammen med "5GI MBB" og har 0 prisregler. Grundsatsen er 300 kr. og 650 kr.
- "5GI MBB" har 5 regler. "Specialkampagne 2026" (prioritet 10, alle kampagner undtagen 23) ville passe på **alle 290** salg nævnt nedenfor og give 225 kr.
- **Fra 24. sept. kl. 15:26 til i dag** er der kommet 290 salgslinjer ind på det sammenlagte produkt. Alle står til 300 kr. uden regel. Det giver 87.000 kr. i provision i dag. Med 225 kr. ville det være 65.250 kr., altså en forskel på **21.750 kr.** for Eesy TM-sælgerne.
- Før 24. sept. landede salgene direkte på "5GI MBB".
- I prisberegningen bliver produktet fundet ud fra produktkoden. Den følger ikke sammenlægningen videre til "5GI MBB" og bruger derfor ikke reglerne der. Kun TDC-salgssiden i koden kender sammenlægningen.
- Det er endnu ikke bekræftet, hvorfor det skiftede netop 24. sept. Det kan skyldes, at opkaldssystemet begyndte at sende kode 9461, eller at sammenlægningen blev lavet på det tidspunkt. Det undersøger jeg som det første.
- Sidebemærkning: I september fik 243 salg på "5GI MBB" selv 300 kr. uden regel. Det er en separat sag, som jeg kun undersøger, hvis du ønsker det.

## Forslag
**A. Hurtig rettelse (data, ingen kode)**
Flyt de 290 salgslinjer og produktkoden 9461 over på "5GI MBB". Kør derefter genberegningen af priser kun for de linjer, så de rammer reglerne og får 225 kr. Fremtidige salg lander så direkte på "5GI MBB".

**B. Grundig rettelse (kode i prismotoren, rød zone)**
Lad prisberegningen følge sammenlægningen, så sammenlagte produkter altid bruger hovedproduktets regler. Ændringen skal ske ens i frontend og i baggrundsjobbet. Det kan også ændre provisionen for andre sammenlagte produkter, så jeg laver først en tørkørsel, der viser, hvilke produkter og beløb der påvirkes.

Begge løsninger ændrer provision tilbage til 24. sept. Der gælder følgende:
- Før jeg gør noget, laver jeg en optælling af antal og provision.
- Kun de berørte linjer bliver ændret.
- Efter rettelsen kontrollerer jeg, at summen er 65.250 kr.

**Jeg anbefaler A nu og B som særskilt opgave efter tørkørslen.**

Der bliver ikke ændret noget, før du har godkendt. Provisionen fra 24. sept. skal også godkendes af Kasper eller Mathias, fordi den påvirker løngrundlaget.
