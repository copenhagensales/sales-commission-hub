# Excel-udtræk: Switch Krydssalg — sidste 30 dage

Samme ark som v2, men med periode på 30 dage i stedet for 3 måneder.

## Hvad der laves
Et nyt Excel-ark med de salg på kampagnen "CPH Sales - Switch Krydssalgs kampagne" (105958), der er lavet de sidste 30 dage.

- Én række pr. Sales ID (typisk CVR-nummer)
- Kolonner: Sales ID, Produkter, Antal
- Kun produkterne Omstillingsbruger, Switch Contact Center, Switch Professionel, Switch Unlimited (uanset suffiks som # eller ATL)
- Flere enheder af samme produkt vises i parentes; Antal er samlet antal enheder
- Annullerede salg medtages, som i de tidligere ark

## Teknisk
- Read-only udtræk. Ingen data ændres.
- Periode: rullende 30 dage fra kørselstidspunktet, dansk tid. Den præcise periode oplyses i svaret.
- Sales ID læses fra salgets payload-felt "Sales ID" med fallback til intern reference.
- Produktnavn fra produktets navn med fallback til Adversus-produkttitel.
- Ny fil gemmes i Files ved siden af de to eksisterende; de tidligere ark røres ikke.
