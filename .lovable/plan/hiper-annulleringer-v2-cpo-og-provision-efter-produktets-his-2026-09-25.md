# Hiper-annulleringer v2: CPO og provision efter produktets historik

## Hvad produkthistorikken viser
Hvert Hiper-produkt har to priser: én der gjaldt fra 8.–9. juli og én der gælder fra 15. september.

| Produkt | Provision før 15/9 | Provision fra 15/9 | CPO (uændret) |
|---|---|---|---|
| Hiper Lukning | 200 | 125 | 1.300 |
| Hiper Viderestilling | 400 | 325 | 0 |
| Hiper lukning rabattrin 1 | 175 | 100 | 1.200 |
| Hiper viderestilling rabattrin 1 | 375 | 300 | 0 |
| Hiper lukning rabattrin 2 | 150 | 75 | 1.100 |
| Hiper viderestilling rabattrin 2 | (opslås) | 275 | 0 |

**Hvorfor CPO manglede:** "Hiper Lukning" har desuden en aktiv prisregel, der sætter omsætningen til 0 kr. Den regel går forud for produktets egen pris. Derfor står 303 Lukning-salg fra 9/7–13/9 med 0 kr. i omsætning i Stork, selv om produktets egen pris var 1.300 kr.

## Sådan udfyldes v2 (kun arket, ingen ændringer i Stork)
1. Det er samme matchning som før: én række pr. sælger og produkt, og sælgernavnet står, som det hedder i Stork.
2. **Provision:** den pris fra produktets historik, der gjaldt på salgsdatoen. Alle salg i arket er fra før 15/9, så de får den gamle pris, fx 200 kr. for Lukning. Hvis Stork har gemt en anden provision på salget, markeres cellen orange med en note, der viser Storks tal.
3. **CPO:** den pris fra produktets historik, der gjaldt på salgsdatoen. Lukning-produkterne får altså 1.300, 1.200 eller 1.100 kr. Viderestilling står som 0 kr., fordi den med vilje er 0 kr. Cellen er ikke længere gul.
4. Kunde-id'er, der ikke findes i Stork, står stadig som "Ikke fundet i Stork" og er markeret.
5. Nederst er der en totalrække med formler.
6. Filen gemmes som `hiper_annulleringer_15-8_14-9_udfyldt_v2.xlsx`. Den første udgave bevares.

## Ikke med i denne plan (separat beslutning)
Prisreglen "Hiper Lukning - default" med 0 kr. i omsætning og 200 kr. i provision er stadig aktiv i Stork. Den er grunden til, at rapporterne mangler omsætning på Lukning før 15/9. At rette den hører til pricing-motoren (rød zone), og det kræver jeres godkendelse bagefter.
