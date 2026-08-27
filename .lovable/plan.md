# Gennemsnitlig provision pr. 5G-salg (Eesy TM, 15/7–14/8 2026)

## Mål
Udfyld kolonnen "gnsmt. Provi på 5G" for de 28 sælgere i `Eesy_TM_gnsmt_5G_provision.xlsx` — rækkefølgen bevares uændret.

## Datagrundlag (spejler MV-trækket)
- Klient: Eesy TM (`81993a7b-ff24-46b8-8ffb-37a83138ddba`).
- Periode: salgsdato 15/7 00:00 – 14/8 23:59:59 2026 (dansk tid).
- Kun ikke-annullerede salgslinjer.
- 5G = kun mobilbredbånd/internet-produkter (produktnavn starter med "5GI" eller indeholder "internet") — præcis komplementet til MV-filteret i forrige træk.
- Sælger-match via `employee_agent_mapping` → `agents` mod `sales.agent_email`, samme identitetsopløsning som sidst.

## Beregning
Gennemsnit pr. sælger = samlet `mapped_commission` på 5G-linjer / samlet 5G-antal (quantity), dvs. provision pr. solgt 5G-abonnement.

## Leverance
- `Eesy_TM_gnsmt_5G_provision_udfyldt.xlsx` med kolonne B udfyldt (kr, 0 decimaler) plus to hjælpekolonner: 5G-antal og 5G-provision i alt.
- Sælgere uden 5G-salg i perioden markeres "Ingen 5G-salg" — ikke 0.
- Kort opsummering: samlet 5G-antal, samlet provision og vægtet holdgennemsnit.

## Bemærkning
Ingen ændringer i kodebasen eller databasen — kun læsning og en Excel-leverance.
