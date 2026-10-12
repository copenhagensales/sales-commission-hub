# Nye Mobilevoice-fiberprodukter på tavle/dashboard

Behandl de 6 nye HAP/VOK-produkter (Inkl. Mobilevoice salg) præcis som de eksisterende HAP/VOK på tavlen.

## Regler (kopieret fra de eksisterende)

| Produkt | Point | Tæller i "(+ N fiber)" |
|---|---|---|
| Lukket salg HAP/VOK (Inkl. Mobilevoice salg) | 0,5 | ja |
| Fuldt salg HAP/VOK (Inkl. Mobilevoice salg) | 1,0 | ja |
| Lead Provi HAP/VOK (Inkl. Mobilevoice salg) | 0,5 | nej (som i dag) |

- Fiberprovision på tavlen opsummerer automatisk provisionen på alle produkter i fiberlisten, så de nye kommer med. Indtil satserne er sat i morgen, viser den 0 kr. for dem.
- TDC-månedsmålet vægter også de nye med samme point.
- Nummer reservation er ikke fiber og røres ikke.

## Hvad der ikke røres

Provision, omsætning, prisregler, løn, eksisterende produkter og salg. Kun hvilke produkter tavlen regner som fiber.

## Teknisk

- `src/config/fiberBoardPoints.ts`: tilføj 6 ID'er til `FIBER_BOARD_POINTS` og 4 (Lukket/Fuldt) til `FIBER_SALE_PRODUCT_IDS`.
- `supabase/functions/tv-dashboard-data/index.ts` (linje 2621–2635): samme tilføjelse til `FIBER_BOARD_POINTS_EF` og `FIBER_SALE_PRODUCT_IDS_EF`, holdt 1:1. Deploy funktionen.
- ID'er: Lukket HAP `59f00afb-…`, Fuldt HAP `adc508fa-…`, Lead HAP `4ecf9122-…`, Lukket VOK `7a792b7d-…`, Fuldt VOK `8d7b6403-…`, Lead VOK `b0030dec-…`.
- Kontrol: typecheck/build, og bekræft, at fiberstatistikken svarer uden fejl.
