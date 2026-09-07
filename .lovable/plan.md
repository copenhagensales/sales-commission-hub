# OPP-1096576 vises som ét salg med 6 produkter

## Hvad der faktisk ligger i data (bekræftet)

Der er **to** salg med samme OPP-nummer:

| Tid (4/9) | Sælger | Produkt | Antal | Provision |
|---|---|---|---|---|
| 13:13 | Thorbjørn (thl@) | Mobil Basis (40GB BTL) 0% tilskud | 3 | 2.535 kr |
| 13:40 | Sune (suno@) | Mobil Basis (40GB BTL) 0% tilskud | 3 | 2.535 kr |

Dagsrapporterne viser dem hver for sig, fordi de tælles pr. salg og pr. sælger — det er korrekt.

## Hvorfor "Ret salg" viser 6 under Sune

`src/hooks/useTdcErhvervSales.ts` (linje 97-137) grupperer udelukkende på OPP-nummeret. Sælgernavnet sættes fra den **første** række i gruppen (linje 103-111), og listen er sorteret nyeste først — derfor bliver hele gruppen stemplet med Sune, og Thorbjørns 3 stk. lægges oveni hans 6.

Det er altså en visningsfejl på "Ret salg", ikke en fejl i dagsrapporterne.

## Ændring

1. `src/hooks/useTdcErhvervSales.ts`: grupperingsnøglen bliver **OPP + sælger-email** i stedet for kun OPP. Samme OPP med to sælgere vises dermed som to linjer med hver 3 produkter — magen til dagsrapporterne.
2. Behold nøglen `__no_opp__<sale_id>` for salg uden OPP (uændret).
3. `src/pages/reports/TdcErhvervEditSales.tsx` og redigeringsdialogen arbejder videre pr. gruppe — nu med kun én sælgers salgs-ID'er i `saleIds`, så en rettelse ikke længere kan ramme en anden sælgers salg.

## Bemærkning til jer (ingen ændring foretages)

De to salg er identiske i produkt, antal og OPP med 27 minutters mellemrum. Det ser ud som en mulig dublet, men jeg ændrer intet — sig til hvis I vil have den undersøgt eller fjernet.

## Uden for scope

Ingen ændring i provision, pricing, dagsrapporter, løn eller database. Kun visningen på "TDC Erhverv - Ret salg".
