# Bekræftelse før fibersalg registreres

## Hvad sælgeren oplever
1. Sælgeren udfylder formularen og trykker »Registrér salg«.
2. Formularen tjekkes først (CVR m.m.). Er noget forkert, vises fejlen som i dag, og der kommer ingen boks.
3. Ellers åbnes en bekræftelsesboks (skuffe fra bunden på telefon, vindue på computer) med to spørgsmål:
   - Har du sendt 1. opsigelsesmail til kunden?
   - Har du lavet lead til Hunt?
4. Hvert spørgsmål har »Ja« / »Nej«. Knappen »Bekræft og registrér« er først aktiv, når begge er »Ja«. Svarer man »Nej«, står der kort, at det skal gøres først.
5. »Annullér« lukker boksen; det indtastede bevares.

## Afgrænsning
- Gælder sælgerens egen formular. Admins' »Opret salg for sælger« og rettelser får ikke boksen (sig til, hvis de også skal).
- Svarene gemmes ikke; boksen er kun et stop før indsendelse. Ingen database-, rettigheds- eller provisionsændringer.

## Teknisk
- Kun `src/pages/TdcErhvervFiberPladsholder.tsx`: `send` deles i validering → åbn boks → eksisterende indsendelse ved bekræftelse. Genbruger `BottomSheet`/`Dialog`, knapper min. 44 px.
- Mobilaudit ved 360/393/430 px; intet prøvesalg (rigtig provision).
