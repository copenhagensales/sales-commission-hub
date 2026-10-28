# Udfyld Hiper-annulleringsark

Kunde-id fra arket står på Hiper-salgene i feltet, man søger på under Salg. 91 salg matcher de 48 linjer.

## Hvad der laves
1. Hvert kunde-id matches med de salg i Stork, der har det kunde-id.
2. For hvert matchet salg udfyldes:
   - **produkt**: produktnavn(e) på salget
   - **provi**: provision, som Stork har givet (før annullering)
   - **cpo**: omsætning pr. ordre fra Stork
3. Har flere sælgere salg på samme kunde-id (fx Hiper Lukning og Hiper Viderestilling), indsættes en ny linje lige under, så hver sælger har sin egen linje med sit eget produkt, provi og cpo. Øvrige kolonner kopieres til den nye linje, og sælgernavnet sættes til den rigtige sælger.
4. Har én sælger flere produkter på samme kunde-id, samles de på én linje (produkter adskilt med komma, provi og cpo lagt sammen).
5. Linjer uden match efterlades tomme og nævnes i svaret som antal.

## Regler
- Kun læsning i Stork; intet ændres.
- Den originale fil bevares; resultatet gemmes som ny fil `Hiper_annulleringer_1509-1410_udfyldt.xlsx`.
- Andre kolonner og formatering røres ikke.
- Svaret i chatten indeholder kun antal, ingen navne eller kundedata.
