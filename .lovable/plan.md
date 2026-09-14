# Rettelse af Relatel-salg: 50% tilskud → 0% tilskud

## Hvad jeg har fundet (bekræftet i data)

Salget er identificeret entydigt:

- Sælger: Thorbjørn Larsen (`thor@cph-relatel.dk`), Relatel, kampagne 85913
- Dato: 25. august 2026, kl. 14:26 dansk tid
- Sales ID 25808754 står i dialer-data på salget (feltet "Sales ID")
- Feltet "Tilskud" er registreret som **50%**

Salget har tre linjer, og de er i dag prissat efter produkternes basissatser, fordi der ikke findes en pricing-regel for "50% tilskud":

| Linje | Provision i dag | Omsætning i dag |
| --- | --- | --- |
| Fri Tale - 1000 GB ATL | 1.210 kr | 2.600,00 kr |
| Mobilfeatures ATL | 176 kr | 351,00 kr |
| Datadeling ATL | 176 kr | 351,00 kr |
| **I alt** | **1.562 kr** | **3.302,00 kr** |

De gældende 0%-tilskudsregler (aktive fra 15. juni 2026, altså gældende 25. august) giver:

| Linje | Ny provision | Ny omsætning |
| --- | --- | --- |
| Fri Tale - 1000 GB ATL | 1.615 kr | 3.325,85 kr |
| Mobilfeatures ATL | 335 kr | 639,45 kr |
| Datadeling ATL | 335 kr | 639,45 kr |
| **I alt** | **2.285 kr** | **4.604,75 kr** |

Det betyder +723 kr i provision og +1.302,75 kr i omsætning på salget.

## Hvad jeg vil gøre

1. Rette de tre linjer på salget til 0%-tilskudssatserne ovenfor, i én samlet handling.
2. Låse linjerne som manuelt rettede, så det natlige gennemløb af prisregler ikke overskriver rettelsen igen.
3. Logge rettelsen i den historiske log over manuelle prisrettelser, med før- og efterbeløb, feltet "Tilskud" (50% → 0%) og en begrundelse der nævner Sales ID 25808754.

## Hvad jeg ikke gør

- Jeg ændrer ikke de rå data fra ringesystemet — de bevares som de kom ind, så historikken er intakt.
- Jeg ændrer ingen andre salg, ingen prisregler og ingen produkter.
- Jeg ændrer ikke lønberegninger direkte; provisionen på dette salg indgår i lønnen efter systemets normale regler, som ethvert andet salg.

## Teknisk (til reference)

- Salg: `sales.id = a8ff9227-5a26-48d5-8edc-d3195ab2c83d` (`adversus_external_id = 1500146`, lead 1020501911)
- Linjer i `sale_items`: `7e3eeb68…` (produkt `25c13052…`), `e8621451…` (`3f172eb3…`), `a299caf5…` (`b0c7c77f…`)
- Kildesatser: `product_pricing_rules` med `conditions = {"Tilskud":"0%"}`, `effective_from = 2026-06-15`: `cc00bf87…` (1615/3325.85), `8dddd5cd…` (335/639.45), `1c5b722a…` (335/639.45)
- Sætter `manual_pricing_lock = true` på de tre linjer (respekteres af `rematch-pricing-rules`)
- Indsætter tre rækker i `sales_manual_pricing_corrections` (immutable log), samme mønster som rettelsen af Sales ID 45785734
- Ren dataopdatering via SQL i én transaktion — ingen kodeændringer, ingen migration, ingen ændring af RLS
