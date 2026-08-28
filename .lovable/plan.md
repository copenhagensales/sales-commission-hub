# Udfyld CPO på fanen "Hiper annulleringer"

## Mål
Tilføj kolonnen "CPO" til højre for "Provi" på fanen `Hiper annulleringer` (70 linjer) i det uploadede ark, med samme matchning som da Provi blev udfyldt.

## Bekræftet i data
Hiper-produkternes registrerede omsætning (`sale_items.mapped_revenue`) ligger udelukkende på lukningen — viderestillingen har 0 kr. omsætning:

| Produkt | Provision | Omsætning |
| --- | --- | --- |
| Hiper Lukning | 200 | 1.300 |
| Hiper Viderestilling | 400 | 0 |
| Hiper lukning rabattrin 1 / 2 | 175 / 150 | 1.200 / 1.100 |
| Hiper viderestilling rabattrin 1 / 2 | 375 / 350 | 0 |

Det betyder at CPO-kolonnen får et beløb på lukningslinjerne og 0 på viderestillingslinjerne. Det er systemets faktiske registrering, ikke en fejl i udtrækket.

## Metode
- Samme match som ved Provi: `customer_id` mod `sales.customer_phone` under klienten Hiper, sælger via identitetsopslag på `user_name`.
- CPO pr. linje = `mapped_revenue × antal` på netop den salgslinje (lukning eller viderestilling) linjen repræsenterer.
- Linjer markeret "Ikke fundet" får tom CPO.
- Rækkefølge og alle eksisterende kolonner bevares uændret; de øvrige faner (`Opgørelse`, `Data (Outbound)`) røres ikke.

## Leverance
`Eesy_tm_samlede_annulleringer_med_CPO_udfyldt.xlsx` med CPO udfyldt, plus en kort opsummering af samlet provision og samlet CPO på de matchede linjer.

## Bemærkning
Ingen ændringer i kodebasen eller databasen — kun læsning og en Excel-leverance.
