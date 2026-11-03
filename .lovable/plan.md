# Plan: Prisspærring og Eesy-refusion på FM-bookinger og lokationer (rev. 2)

Gul zone (FM-booking, ikke pricing). Ingen ændring af lederens DB-beregning, løn eller provision. Coop-fakturagrundlaget (Excel/PDF, totaler, rabat) ændres ikke. SEND INTET under byg/kontrol.

## Vigtigt: tilbagerul tidligere ændring

Den tidligere plan blev allerede delvist bygget: `supabase/functions/send-supplier-report/index.ts` linje 360 står nu `includeSurcharge: false` og er udrullet. Det sættes tilbage til `true` (som før), så Eesy igen får sektionen "Merpris og refusion / Til refusion fra Eesy FM" ved manuel afsendelse. Tilhørende note i `supabase/functions/AGENTS.md` fjernes. Funktionen udrulles igen uden afsendelse.

## Del 1 – Spærring mod urealistisk lave priser (< 100 kr. pr. booket dag)

Uændret i forhold til forrige plan:
- Én regel i `src/lib/fm/lowPriceGuard.ts` (grænse 100 kr./dag) med tests.
- Booking (opret/redigér: `EditBookingDialog.tsx`, `BookWeekContent.tsx`): begrundelse påkrævet under grænsen, gemmes i `booking.price_note`, logges i `booking_price_audit`; infotekst ved prisfeltet; databasen afviser lav pris uden begrundelse.
- Lokation: daily_rate under 100 kr. kræver begrundelse (`location.daily_rate_note`). Mangler stadig i `LocationsContent.tsx` – tilføjes.
- Datakvalitet: liste over bookinger under 100 kr./dag i indeværende og forrige lønperiode i `useDbDataQuality` / `DbDataQualityPanel`.

## Del 2 – Eesy-refusion på direkte afregnede kæde-lokationer

### Lokationen
- Gælder kun lokationer, hvis type IKKE er "Coop butik" (fx "Anden lokation", "Butik").
- Nye felter i lokationsredigering: **Kæde** (Kvickly / SuperBrugsen / ingen), **Refusion pr. dag**, **Refunderes af** (standard Eesy FM). **Pris til lokationen (brutto)** beholdes som valgfrit.
- Når kæde vælges, foreslås refusion ud fra kædereglen i `location_rate_surcharges` (fx Kvickly 750, SuperBrugsen 250); værdien kan overskrives.
- `daily_rate` er fortsat NETTO. DB-beregningen (`booking_gross_amount`, `bookingGross`, `useClientDbData`) ændres ikke.
- Visningslinjen "Vi betaler 1.750 · Eesy refunderer 750 · Netto 1.000" på lokation og booking bevares.

### Coop-leverandørrapporten – kun i refusionsdelen
Direkte afregnede kæde-lokationer med bookinger i perioden tages med, men **kun** som refusion:
- UI-boksen "Merpris og refusion" (`SupplierReportTab.tsx`) og mailen til Eesy (`send-supplier-report`, både manuel og via `supplier-report-scheduler`): ny undersektion **"Direkte afregnet – refunderes af Eesy"** med én linje pr. lokation: navn, datoer, dage, refusion pr. dag, beløb.
- "Til refusion fra Eesy FM" = Coop-tillæg + direkte afregnede.
- De indgår IKKE i: Excel-arket (fortsat kun total pr. butik, fx 1.750), PDF/fakturagrundlaget til Coop, `total_amount`, `base_amount`, `final_amount`, rabatberegningen eller `unique_locations`.
- Kun bookinger hvor `booking.client_id` = lokationens "Refunderes af"-kunde giver refusion (samme princip som `funded_by_client_id`).
- Ved godkendelse gemmes de separat: ny kolonne `direct_refund_amount` og en separat nøgle i `report_data` (fx `direct_refunds`). `surcharge_refundable_amount` for Coop-butikkerne forbliver uændret; samlet refusion vises som summen.
- Én fælles beregning (ren funktion i `src/lib/fm/` med 1:1-spejl i `supabase/functions/_shared/`, tests sammenligner filerne), brugt af UI, mail og scheduler.

## Migration (én, additiv)

```text
ALTER TABLE location ADD COLUMN chain_match text NULL
  CHECK (chain_match IN ('Kvickly','SuperBrugsen'));
ALTER TABLE supplier_invoice_reports ADD COLUMN direct_refund_amount numeric NULL;
```
Felterne `gross_daily_rate`, `refund_daily_rate`, `refund_client_id`, `daily_rate_note` findes allerede fra migration 0083. Ingen nye tabeller, ingen ny RLS/anon-adgang, ingen SECURITY DEFINER. Eksisterende rapporter og rækker uændrede.

## Filer

- `src/pages/vagt-flow/LocationDetail.tsx`, `LocationsContent.tsx` – kæde/refusion-felter, begrundelse.
- `src/lib/fm/refusionLinje.ts` (+ test), `src/hooks/useLocationRefundLine.ts`, `RefusionLinje.tsx` – genbruges.
- Ny `src/lib/fm/directRefunds.ts` + `supabase/functions/_shared/directRefunds.ts` (+ tests).
- `src/components/billing/SupplierReportTab.tsx` – undersektion, gem ved godkendelse.
- `supabase/functions/send-supplier-report/index.ts` – `includeSurcharge: true` tilbage, ny undersektion i mailen.
- `supabase/functions/supplier-report-scheduler/index.ts` – samme refusionsdata.
- Excel-/PDF-generering røres ikke.

## Uafklaret / bekræftes ved byg
- Om lokationer uden valgt kæde men med manuel refusion også skal med i Coop-rapporten (planen: kun når kæde er valgt).
- Om scheduler genbruger beregningen direkte eller kalder send-supplier-report – kortlægges før byg.
- Ingen rigtig mail sendes; mailindhold kontrolleres kun via test.
