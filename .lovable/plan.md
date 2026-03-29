
## Problem
Den sidste fejl ligger ikke i den generelle kurv-logik, men i hvordan `5G Internet` bliver identificeret som et `phone_excluded` produkt.

Lige nu sker dette i praksis:
- I `UploadCancellationsTab.tsx` kan rækken falde igennem **Pass 1b** som et almindeligt telefon-match.
- Her bliver `targetProductName` bevaret som rå upload-værdi (`"Fri tale + 70 GB data (5G)..."`) i stedet for det interne produkt (`"5G Internet"`).
- Når rækken sendes til køen, afgør klassificeringen `correct_match` vs `basket_difference` kun ud fra `targetProductName`.
- Derfor ender 5G-rækken forkert som **Kurv-rettelse**.

## Løsning
Jeg vil rette det helt lokalt omkring `phone_excluded`-flowet, uden at røre den øvrige kurv-logik.

### 1. Gør `phone_excluded`-detektion robust
I `src/components/cancellations/UploadCancellationsTab.tsx`:
- indføre én fælles helper til at afgøre, om et produkt matcher `phone_excluded_products`
- bruge den mod både:
  - uploadens/resolved produktnavn
  - systemets faktiske produkt på salget (`realProductName`)

Det fjerner afhængigheden af, at uploadteksten skal ligne `"5G Internet"` ordret.

### 2. Ret Pass 1b for 5G Internet
I `src/components/cancellations/UploadCancellationsTab.tsx` omkring **Pass 1b**:
- efter et telefon-match er fundet, læse `realProductName` fra salget
- hvis systemproduktet er `phone_excluded` (fx `5G Internet`), så:
  - sætte `targetProductName` til systemproduktet
  - springe den nuværende “ambiguity override”/rå upload fallback over for netop disse produkter

Effekt:
- 5G-rækker bliver behandlet som validerede specialmatches
- de havner ikke som falske kurvrettelser

### 3. Ret klassificeringen ved afsendelse til kø
I `sendToQueueMutation` i samme fil:
- ændre `isPhoneExcluded`-beregningen til at bruge **`targetProductName OR realProductName`**
- klassificere rækken som `correct_match`, hvis enten target eller systemprodukt er `phone_excluded`

Det sikrer korrekt `upload_type` i køen.

### 4. Gør køvisningen konsekvent
I `src/components/cancellations/ApprovalQueueTab.tsx`:
- opdatere `isPhoneExcluded`-beregningen til også at kunne falde tilbage på systemets salgsprodukter, ikke kun `target_product_name`

Det gør visningen robust, også hvis et ældre queue-item har et mindre præcist target-navn.

## Teknisk scope
Filer:
- `src/components/cancellations/UploadCancellationsTab.tsx`
- `src/components/cancellations/ApprovalQueueTab.tsx`

Ingen databaseændringer.
Ingen ændring af den generelle produktmatcher i `productConditionMatcher.ts`.

## Verificering
Jeg vil verificere på den konkrete 5G-case fra dit screenshot:

1. Upload samme række igen
2. Bekræft at den klassificeres som **Korrekt match**
3. Bekræft at den **ikke** vises under **Kurv-rettelser**
4. Bekræft at almindelige ikke-5G kurvrettelser stadig lander korrekt som `basket_difference`

Hvis der allerede ligger en forkert 5G-række i den nuværende kø, skal den gamle pending import ryddes/genkøres for at se den nye klassificering rent.
