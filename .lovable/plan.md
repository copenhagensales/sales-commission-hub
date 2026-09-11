# Verifikation: mødetype på nye Lederne-ark

## Formål
Bekræfte, at et nyt ark med kolonne "Mødetype" giver de rigtige satser: Telefonmøde 30 kr, Onlinemøde 90 kr, tom mødetype 75 kr. Ingen rigtige salg må ændres.

## Nuværende tilstand (verificeret)
- Lederne har to aktive regler fra 7. september: Tlfmøde 30 kr (prioritet 1) og Onlinemøde 90 kr (prioritet 0). Omsætning 200 kr på begge.
- Produktets basissats er 75 kr provision / 200 kr omsætning, og alle 2.793 eksisterende Lederne-linjer står på den.
- Importen læser i dag kolonne 7 (Mødetype) og gemmer værdien på salget, og kalder derefter prisberegningen for de nye salg.

## Sådan verificeres det
1. Jeg opretter tre testsalg på Lederne med opdigtede testnumre, ét pr. tilfælde: Telefonmøde, Onlinemøde og uden mødetype.
2. Jeg kontrollerer, hvad hvert testsalg får i provision, og at det matcher 30 / 90 / 75 kr.
3. Jeg sletter de tre testsalg igen, så de ikke tælles med i rapporter, provision eller løn.
4. Jeg kontrollerer bagefter, at antallet af Lederne-salg igen er 2.793, og at alle står på 75 kr — altså at intet rigtigt salg er berørt.

Alternativt (hvis du foretrækker det): du uploader et rigtigt ark og kører kun "Kontrollér" (tørkørsel) uden at importere, og jeg læser resultatet igennem. Så oprettes der slet ingen testsalg.

## Rapportering
Jeg melder tilbage med: hvilken mødetype hvert testsalg havde, hvilken sats og hvilken regel systemet valgte, samt bekræftelse på at testsalgene er slettet og at de rigtige salg er uændrede.

## Teknisk
- Berørt kode ændres ikke; det er ren verifikation af `manual-sales` (mødetype gemmes under nøglen `Hvilket type møde`) og `rematch-pricing-rules` (regelvalg + fallback til basispris).
- Testsalg oprettes med kilden `manual_entry` på Lederne-produktet og fjernes igen inklusive deres salgslinjer.
- Ingen ændringer i skema, RLS, provisionssatser, eksisterende `sale_items` eller lønsider.
