# Udfyld Hiper-annulleringsark (15/8–14/9)

Ren læsning i Stork. Ingen ændringer i app, database eller løndata. Resultatet gemmes som en ny fil i Filer. Den uploadede fil røres ikke.

## Fremgangsmåde
1. For hver linje i arket slås **customer_id** op blandt Storks Hiper-salg. Hiper-salg er manuelle salg fra Hiper-kanalen, og i Stork ligger kunde-id'et i feltet for telefonnummer.
2. Der laves **én række pr. sælger og produkt**. Findes flere sælgere eller produkter på samme kunde-id, indsættes ekstra rækker lige under den oprindelige linje. De ekstra rækker får samme order_id, datoer og status som den oprindelige linje.
3. **Sælger:** navnet skrives, som det står i Stork, uanset hvordan det er stavet i arket. Jeg bruger det fulde navn fra medarbejderdata og retter dobbelte mellemrum, fx "Casper Haaber Løje Andersen" og ikke "Casper LÃ¸je Andersen".
4. **Produkt:** Storks produktnavn, fx "Hiper Viderestilling" eller "Hiper lukning rabattrin 2".
5. **Provision:** den provision, Stork har beregnet for produktet på salget.
6. **CPO/omsætning:** Storks omsætning for produktet. Er den 0 kr. i Stork, lades feltet tomt og markeres med gult.
7. Er kunde-id'et ikke fundet i Stork, skrives "Ikke fundet i Stork" i produktfeltet, og rækken markeres.
8. Nederst kommer en totalrække for provision og CPO med formler.

## Leverance
- `/mnt/documents/hiper_annulleringer_15-8_14-9_udfyldt.xlsx`
- I chatten: antal fundne og ikke-fundne kunde-id'er, antal ekstra rækker og antal gule CPO-felter.

## Opmærksomhed
- Mange kunder har to sælgere på det samme produkt, fx Silas Soelberg-Larsen og Silke Agergaard Jakobsen. Begge får hver deres række med den fulde provision, som Stork har registreret. Beløbene tages, som de står. Om det er en fordeling eller en dublet, afgøres ikke her.
- Salgsdatoerne i Stork kan ligge før perioden, fx i juli. Det er den oprindelige salgsdato, og den ændres ikke.
