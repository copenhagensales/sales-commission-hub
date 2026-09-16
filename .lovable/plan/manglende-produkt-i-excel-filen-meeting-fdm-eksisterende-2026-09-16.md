# Manglende produkt i Excel-filen: "Meeting -- FDM eksisterende"

## Svar først
Ja — produktet er udeladt, og det er bekræftet i data. Det var ikke et bevidst valg, men en konsekvens af hvordan udtrækket koblede salg til kunde.

## Evidens
- Produktet findes aktivt på kampagnen "Tryg Products" (kunde Tryg, som ligger under teamet United).
- I august 2026 er der 77 salgslinjer / 77 enheder på produktet.
- Alle 77 salg har ingen kundekampagne sat (`client_campaign_id` er tom). De er de eneste 77 af i alt 8.474 augustsalg uden kampagne.
- Salgene kommer fra kilden "tryg" og ligger på én sælger (chgo@copenhagensales.dk), 18/8 og frem.
- Udtrækket til filen koblede salg → kampagne → kunde. Uden kampagne på salget faldt de derfor helt ud, selv om produktet klart hører til Tryg.

## Hvad jeg foreslår
Lav en ny version af filen (v2) med samme indhold som før, men hvor kundetilknytningen får et fallback:
1. Primært: kunde via salgets kampagne (som i dag).
2. Fallback: hvis salget mangler kampagne, brug kunden fra det solgte produkts egen kampagne.
Kun salg, der på den måde lander hos en United-kunde, kommer med — samme afgrænsning som før (august 2026, dansk tid, alle salg inkl. annullerede, enheder via antal).

Forventet ændring: Tryg får en ekstra linje "Meeting -- FDM eksisterende" med 77 enheder. Øvrige tal er uændrede.

Filen leveres som `antal-salg-pr-produkt-united-august-2026_v2.xlsx`, så den oprindelige fil bevares.

## Bemærkning uden for opgaven
De 77 salg mangler kampagnetilknytning i databasen. Det påvirker enhver rapport, der grupperer på kunde/kampagne. Jeg retter ikke data her — det er en separat beslutning, og jeg vender tilbage med rodårsag og forslag, hvis du vil have det undersøgt.

## Teknisk
- Rent læsende udtræk fra `sales`, `sale_items`, `products`, `client_campaigns`, `clients`, `team_clients`.
- Ingen kodeændringer, ingen migrationer, ingen dataopdateringer.
