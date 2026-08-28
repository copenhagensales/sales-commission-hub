# Gns. omsætning/CPO pr. salg — Eesy TM, 15/7–14/8 2026

## Mål
Ét Excel-ark med gennemsnitlig omsætning (CPO) pr. solgt enhed pr. sælger, opdelt i MV og 5G side om side.

## Datagrundlag (samme metode som provisionstrækkene)
- Klient: Eesy TM (`81993a7b-ff24-46b8-8ffb-37a83138ddba`) via `client_campaigns`.
- Periode: salgsdato 15/7 00:00 – 14/8 23:59:59 2026 (dansk tid).
- Kun ikke-annullerede salgslinjer.
- 5G = produktnavn starter med "5GI" eller indeholder "internet". MV = resten.
- Sælger-match via `employee_agent_mapping` → `agents` mod `sales.agent_email` (samme identitetsopløsning som tidligere træk).

## Beregning
Pr. sælger og kategori: `SUM(mapped_revenue) / SUM(quantity)` = omsætning pr. solgt abonnement. Provision pr. stk tages med som reference, så tallene kan holdes op mod de tidligere ark.

## Leverance
`Eesy_TM_gnsmt_omsaetning_MV_5G.xlsx` med én række pr. sælger og kolonner:
- MV: antal, omsætning i alt, gns. omsætning pr. stk, gns. provision pr. stk
- 5G: antal, omsætning i alt, gns. omsætning pr. stk, gns. provision pr. stk
- Totalrække med vægtede gennemsnit (Excel-formler, ikke hårdkodede tal)
- Sælgere uden salg i en kategori markeres "Ingen salg" — ikke 0

Kendte totaler til kontrol: MV 1.005 stk / 658.150 kr (655 kr/stk), 5G 395 stk / 256.750 kr (650 kr/stk).

## Bemærkning
Ingen ændringer i kodebasen eller databasen — kun læsning og en Excel-leverance.
