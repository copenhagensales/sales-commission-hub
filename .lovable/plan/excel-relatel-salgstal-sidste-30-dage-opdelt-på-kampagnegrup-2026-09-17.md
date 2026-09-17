# Excel: Relatel salgstal sidste 30 dage, opdelt på kampagnegrupper

Read-only udtræk. Ingen kode, data eller priser ændres.

## Gruppering (bekræftet i data)

| Gruppe | Kampagne(r) |
| --- | --- |
| Winback | CPH Sales - Winback kampagne (107140) |
| Krydssalg | CPH Sales - Switch Krydssalgs kampagne (105958) |
| Øvrige | Cph Sales - Google (85913), Google 1-5 (98374), Google 6-14 (98375), CPH Sales - Blandet (101396) |

## Arkets indhold

Én række pr. gruppe med:
- Antal salg (stk) = solgte enheder (sum af antal på salgslinjerne)
- Antal unikke Sales ID (CVR)
- Samlet omsætning (CPO) for gruppen
- Andel i % af samlet antal stk
- Andel i % af samlet omsætning

Totalrække nederst. Procenter og totaler laves som Excel-formler, ikke hårdkodede tal.

## Tal med nuværende periode (rullende 30 dage, dansk tid)

| Gruppe | Stk | Unikke CVR | Omsætning | Andel stk |
| --- | --- | --- | --- | --- |
| Winback | 6 | 2 | 13.802 kr | 1,0 % |
| Krydssalg | 145 | 88 | 261.225 kr | 19,3 % |
| Øvrige | 601 | 185 | 1.108.259 kr | 79,7 % |
| Total | 752 | — | 1.383.285 kr | 100 % |

Den præcise periode (dato + klokkeslæt) skrives i arket og i svaret.

## Teknisk

- Klient Relatel via `client_campaigns`, gruppering på `sales.dialer_campaign_id`.
- Enheder og omsætning fra `sale_items.quantity` / `mapped_revenue`.
- Sales ID læses fra `raw_payload.masterData` (label indeholder "Sales ID") med fallback til `internal_reference`.
- Annullerede salg medtages, som i de tidligere Switch-ark.
- Unikke CVR summerer ikke nødvendigvis til totalen, da samme CVR kan optræde i flere grupper; totalrækken viser unikke CVR på tværs.
- Ny fil i Files ved siden af de eksisterende Switch-ark.
