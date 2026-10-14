# Ret tilskud til 100 % på Jacob Nielsons Relatel-salg (14. okt.)

## Hvad jeg har fundet (kun læst)
- Salget er Jacob Nielsons Relatel-salg fra 14. okt. kl. 13:54 (Relatel CPHSALES) med 4 produkter.
- Adversus sendte salget med feltet **Tilskud = "0%"**. De to produkter med regler ramte derfor reglen "Uden tilskud".
- Der findes ingen regel for 100 % tilskud. Uden "0%" bruger systemet produktets grundsats, og det svarer til, hvad andre salg med tilskud får i dag.

| Produkt | Antal | Nu (0 %) | Med 100 % tilskud |
|---|---|---|---|
| MBB 2000GB ATL | 2 | 2.890 kr. / 6.652 kr. | 2.080 kr. / 5.200 kr. |
| Fri Tale - 2000 GB BTL #5 | 1 | 1.655 kr. / 3.726 kr. | 1.250 kr. / 3.000 kr. |
| MBB 2000GB BTL #6 + Router | 1 | 950 kr. / 2.300 kr. | 950 kr. / 2.300 kr. (uændret) |
| **I alt** | 4 | **5.495 kr. / 12.678 kr.** | **4.280 kr. / 10.500 kr.** |

Provisionen falder 1.215 kr. og omsætningen 2.178 kr. Det er altså en nedjustering.

## Rettelse
1. På salget ændrer jeg kun tilskudsfeltet fra "0%" til "100%". Alt andet på salget bliver ikke rørt.
2. Jeg genberegner priserne for præcis dette salg, først med en prøvekørsel. Den rigtige genberegning kører jeg kun, hvis prøven viser 4.280 kr. og 10.500 kr.
3. De tre ændrede linjer låser jeg som manuelt rettet. Så bliver de ikke overskrevet ved en senere genberegning.
4. Bagefter kontrollerer jeg, at kun disse 4 linjer er ændret.

## Bemærk
- **Ret også salget i Adversus.** Hvis Adversus sender salget igen med 0 %, kan selve tilskudsfeltet blive overskrevet. Låsen beskytter provisionen, men feltet kan stadig ændre sig.
- Den gælder også for Kasper og Mathias, fordi ændringen påvirker løngrundlaget.

## Teknisk
- Feltet findes i `raw_payload.leadResultData`, element med label "Tilskud" (id 117476).
- Rematch med `sale_ids=[8e12071d-…]`, derefter `manual_pricing_lock=true` på de 3 linjer.
- Der er ingen kodeændringer.
