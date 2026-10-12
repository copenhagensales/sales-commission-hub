# Vis Adversus-ID på de 7 nye produkter

## Årsag
- Koblingen er i orden: alle 7 produkter er koblet til deres Adversus-ID (11986, 12134–12139). Første salg lander derfor på det rigtige produkt.
- MG Test henter ID'et fra produkternes salgsposter. Har et produkt ingen salg, bruger listen i stedet produktets felt for eksternt ID (`MgTest.tsx:751`). Det felt blev ikke udfyldt, da produkterne blev oprettet. Derfor står der "(mangler)".

## Rettelse
- Udfyld feltet `external_product_code` på de 7 produkter med det Adversus-ID, de allerede er koblet til.
- Ingen ændringer i kode, satser, koblinger, prisregler eller salg.

## Kontrol
- Læs de 7 rækker tilbage og tjek, at det nye felt og koblingen har samme ID.
