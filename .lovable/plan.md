# Finansforbundet-TRYG: mødetype-regler rammer ikke

## Rodårsag (bekræftet)
Feltnavnet staves forskelligt to steder, og matchningen kræver eksakt ens navn.

- De to prisregler på "Partnersalg Finansforbundet - TRYG" har betingelsen på feltet **"Hvilket type møde"** (Onlinemøde → 90/200, Telefonmøde → 30/200, gyldige fra 07-09-2026).
- Det nyeste salg (16-09 09:54) kommer ind fra Adversus-kampagne 80333 med feltet **"Hvilken type møde" = Onlinemøde**.
- Matchningen i `supabase/functions/integration-engine/core/sales.ts:193` finder feltet med `f.label === condKey` — altså eksakt tekstsammenligning. "Hvilket" ≠ "Hvilken", så betingelsen fejler, og salget falder tilbage til hovedsatsen 75/200 (bekræftet på salgslinjen: 75 kr / 200 kr, ingen matchet regel).
- Salg fra 14-09 og 15-09 har slet ikke feltet med — de blev lavet før feltet blev tilføjet i Adversus.

## Løsning
Ren datakonfiguration — ingen kodeændringer.

1. Ret betingelsesnøglen på de to regler fra "Hvilket type møde" til "Hvilken type møde" (samme stavemåde som Adversus sender). Satser, prioritet, gyldighedsdato og kampagneafgrænsning er uændrede.
2. Kør rematch på Finansforbundet-TRYG-salg fra 07-09-2026 og frem, så de salg der faktisk har mødetype med, får den rigtige sats.

Forventet resultat: salg med "Onlinemøde" → 90 kr, "Telefonmøde" → 30 kr. Salg uden mødetype (dvs. dem lavet før feltet blev oprettet i Adversus) bliver stående på 75 kr — der er ingen data at matche på, og de skal ikke gættes.

## Verifikation efter kørslen
- Optælling pr. sats og mødetype på produktet fra 07-09 og frem.
- Kontrol af at det nyeste salg (16-09) står på 90 kr.
- Kontrol af at FDM-produktets satser er urørte.

## Bemærkninger
- Ingen løn- eller provisionshistorik uden for dette produkt berøres, og manuelt låste salgslinjer springes over af rematch.
- Feltnavnet er nu følsomt over for stavemåde begge veje. Hvis I vil have matchningen gjort robust (fx ufølsom over for store/små bogstaver og mellemrum), er det en separat ændring i rød zone, som jeg gerne laver som selvstændig opgave.
