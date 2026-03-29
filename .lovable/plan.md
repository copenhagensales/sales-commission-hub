
Do I know what the issue is? Yes.

Det, der stadig er forkert, er ikke selve “annullering”-klassificeringen. Rækkerne bliver korrekt klassificeret som annulleringer via `Annulled Sales` / `Current Status`.

Den egentlige fejl er produkt-resolutionen før match:
- Upload-rækker med `Subscription Name = "5G Internet Ubegrænset data"` bliver i nogle tilfælde løst til et Eesy-produkt.
- Når det sker, matcher Pass 2 derefter korrekt på sælger + dato mod et Eesy-salg, og derfor ender rækken stadig i annullering på det forkerte salg.
- Derfor hjælper den tidligere “reverse 5G”-guard ikke nok: den bliver omgået, fordi upload-produktet allerede er blevet omtolket til Eesy inden match.

Jeg kan se det flere steder:
- I køen findes rækker med `uploaded_subscription_name = "5G Internet Ubegrænset data"` men `target_product_name = "Eesy ..."`
- Klienten har både:
  - et eksplicit mapping `5G Internet Ubegrænset data -> 5G Internet`
  - `phone_excluded_products = ["5G Internet"]`
  - fallback mapping til `5G Internet`
- Alligevel vinder de brede Eesy-betingelser først.

Plan:
1. Lås 5G-resolution tidligere i matching-flowet  
   I `src/components/cancellations/UploadCancellationsTab.tsx` laver jeg en fælles helper til produkt-resolution for upload-rækker, så denne prioritet bruges konsekvent:
   - først: eksplicit mapping / fallback til et `phone_excluded` produkt
   - derefter: condition-based matching for øvrige produkter  
   Det gør, at en række som tydeligt er 5G ikke kan blive “overtaget” af brede Eesy-regler.

2. Brug samme resolution i både Pass 1b og Pass 2  
   I dag bliver produktet løst flere steder med lidt forskellig logik. Jeg samler det, så 5G behandles ens i:
   - FM phone match (Pass 1b)
   - seller + product + date/customer fallback (Pass 2)

3. Behold den omvendte 5G-guard  
   Den eksisterende guard skal blive, men nu vil den virke korrekt, fordi upload-produktet fortsat er 5G og ikke allerede er blevet omskrevet til Eesy.

4. Gør match-reglen tydelig for 5G-annulleringer  
   Når upload-produktet er `phone_excluded`:
   - må rækken kun matche salg med samme `phone_excluded` produkt
   - ellers skal den falde videre til “Fejl i match” / manuel håndtering, ikke til et Eesy-salg

5. Ryd op i den aktuelle konsekvens  
   Koden vil rette nye imports/match-kørsler. Eksisterende kø-rækker, som allerede er oprettet forkert, skal genmatches eller genoprettes, ellers vil de fortsat se forkerte ud i UI.

Filer:
- `src/components/cancellations/UploadCancellationsTab.tsx`

Teknisk note:
- Jeg ændrer ikke den generelle Eesy-logik.
- Fixet bliver målrettet `phone_excluded_products` (her: 5G Internet), så resten af matching-flowet bevares.
