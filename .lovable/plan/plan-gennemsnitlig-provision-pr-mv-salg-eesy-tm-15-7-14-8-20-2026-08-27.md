# Plan: Gennemsnitlig provision pr. MV-salg (Eesy TM, 15/7–14/8 2026)

## Mål
Udfyld kolonnen "Gnmst. Provi pr. MV" for de 28 sælgere i `gennemsnitprovi_eesy_tm.xlsx` — samme rækkefølge som i arket.

## Datagrundlag (samme metode som Eesy TM-trækket)
- Klient: Eesy TM (`81993a7b-ff24-46b8-8ffb-37a83138ddba`).
- Periode: salgsdato 15/7 00:00 – 14/8 23:59:59 2026.
- Kun ikke-annullerede salgslinjer.
- MV = alle produkter der IKKE er 5G/mobilbredbånd (produktnavn starter med "5GI" eller indeholder "internet" ekskluderes).
- Sælger-match: `employee_agent_mapping` → `agents` mod `sales.agent_email`, samme identitetsopløsning som sidste træk (alle 28 blev matchet entydigt).

## Beregning
Gennemsnit pr. sælger = samlet `mapped_commission` på MV-linjer / samlet MV-antal (quantity). Altså provision pr. solgt MV-abonnement, ikke pr. salgsordre.

## Leverance
- `gennemsnitprovi_eesy_tm_udfyldt.xlsx` med kolonne C udfyldt (kr, 0 decimaler) samt to hjælpekolonner: MV-antal og MV-provision i alt, så gennemsnittet kan efterprøves.
- Sælgere uden MV-salg i perioden markeres som "Ingen MV-salg" — ikke 0.
- Kort opsummering: samlet MV-antal, samlet provision og vægtet gennemsnit for hele holdet.

## Bemærkning
Ingen ændringer i kodebasen eller databasen — udelukkende læsning og en Excel-leverance.
