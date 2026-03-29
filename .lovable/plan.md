
Do I know what the issue is? Yes.

Problemet er ikke længere kun UI. Der er mindst 3 fejl i selve match-logikken, og de forklarer præcis de to eksempler du har sendt:

1. `src/utils/productConditionMatcher.ts`
- `in` / `not_in` regler er for skrøbelige.
- Matcher’en splitter kun på komma/semikolon.
- Dine Eesy-regler ser ud til at være gemt som samlede tekstværdier som fx `Yousee Telmore` eller flere subscriptions i én streng.
- Konsekvens: `in` fejler ofte, mens brede `not_in` regler bliver for nemme at matche, så rækker havner på et forkert Eesy-produkt.

2. `src/components/cancellations/UploadCancellationsTab.tsx` i Pass 1b
- Når `resolvedProduct` ikke findes, tillader koden stadig et rent telefon-match.
- Derefter sættes `targetProductName` til salgets første produkt.
- Det fabrikerer et falsk produktmatch og giver `correct_match`, selv når upload-produktet slet ikke matcher salget.

3. Samme fil i 5G-flowet
- 5G / `phone_excluded` afgøres stadig via for snævre streng-sammenligninger.
- En upload-række som `Fri tale + fri data (5G)` eller `Fri tale + 70 GB data (5G)` bliver ikke sikkert genkendt som den særlige 5G-type.
- Derfor ryger den ikke ind i den rigtige speciallogik og ender med at blive behandlet som et almindeligt produktmatch.

Det jeg vil bygge:
1. Gør condition-matching robust
- Opdatér `productConditionMatcher.ts`, så `in` / `not_in` også kan håndtere fejlagtigt sammensmeltede værdier.
- Behold eksakte matches først, men tilføj tolerant evaluering for kombinerede strengværdier.
- Prioritér mere specifikke regler over brede negative regler, så generelle `not_in` regler ikke “sluger” 5G-rækker.

2. Stop falske produktmatches i Pass 1b
- I `UploadCancellationsTab.tsx` må en række uden løst produkt ikke længere blive sendt videre som produktmatch kun fordi telefonen matcher.
- Hvis produktet ikke kan løses, skal rækken enten:
  - gå videre til korrekt specialflow, eller
  - havne som ikke sikkert matchet
- `targetProductName` må aldrig igen blive kopieret fra salgets første item.

3. Lav én fælles og sikker 5G-detektion
- Udtræk en hjælper i `UploadCancellationsTab.tsx`, som afgør om en upload-række tilhører `phone_excluded`-familien.
- Den skal bruge både:
  - canonical produkt-resolution
  - rå upload-værdier
  - eksisterende mapping/conditions
- Så 5G-rækker ikke afhænger af et enkelt eksakt tekstmatch.

4. Re-klassificér køen for den aktuelle import
- De nuværende kø-rækker er allerede gemt med forkert `target_product_name` og `upload_type`.
- Efter logik-fix skal jeg re-beregne den aktive Eesy FM import, så de forkerte `correct_match` bliver rettet til enten:
  - `basket_difference`, eller
  - korrekt 5G-match
- Ellers vil gamle fejl blive stående i Godkendelseskø, selv om koden er rettet.

Berørte filer:
- `src/utils/productConditionMatcher.ts`
- `src/components/cancellations/UploadCancellationsTab.tsx`
- evt. `src/components/cancellations/ApprovalQueueTab.tsx` kun for at sikre visning følger den nye klassificering

Forventet resultat:
- 5G Internet bliver ikke længere matchet via almindelig produktlogik
- En række uden reelt produktmatch kan ikke længere ende som `correct_match`
- Dine to eksempler vil efter re-beregning ikke længere stå som falske korrekte matches

Tekniske noter:
- Jeg har verificeret i data, at den aktuelle Eesy FM import allerede indeholder rækker hvor uploadens `Subscription Name` er 5G-varianter, men `target_product_name` er gemt som almindelige Eesy-produkter.
- Jeg har også verificeret, at Eesy FM-konfigurationen kun har `phone_excluded_products = ["5G Internet"]`, så den nuværende eksakte streng-sammenligning er for snæver til de uploadede 5G-navne.
