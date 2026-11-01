# Bekræftelse før fibersalg registreres

## Hvad sælgeren oplever
1. Sælgeren udfylder formularen og trykker »Registrér salg«.
2. Formularen tjekkes først (CVR m.m.). Er noget forkert, vises fejlen som i dag, og der kommer ingen boks.
3. Ellers åbnes én bekræftelsesboks (skuffe fra bunden på telefon, vindue på computer), hvor begge punkter står samtidigt:
   1. Har du lavet 1. opsigelsesmail til kunden?
   2. Har du lavet lead til Hunt?
4. I bunden af boksen er to knapper: »Ja« og »Nej«.
   - »Ja« registrerer salget.
   - »Nej« lukker boksen uden at registrere; det indtastede bevares.

## Afgrænsning
- Gælder sælgerens egen formular. Admins' »Opret salg for sælger« og rettelser får ikke boksen (sig til, hvis de også skal).
- Svarene gemmes ikke; boksen er kun et stop før indsendelse. Ingen database-, rettigheds- eller provisionsændringer.

## Teknisk
- Kun `src/pages/TdcErhvervFiberPladsholder.tsx`: `send` deles i validering → åbn boks → eksisterende indsendelse ved bekræftelse. Genbruger `BottomSheet`/`Dialog`, knapper min. 44 px.
- Mobilaudit ved 360/393/430 px; intet prøvesalg (rigtig provision).
