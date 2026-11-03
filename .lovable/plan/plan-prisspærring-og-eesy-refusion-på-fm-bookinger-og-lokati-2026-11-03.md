# Plan: Prisspærring og Eesy-refusion på FM-bookinger og lokationer

Gul zone (FM-booking, ikke pricing). Ingen ændring af DB-beregning, løn, provision eller leverandørrapportens indhold. SEND INTET under byg/kontrol.

## Del 1 – Spærring mod urealistisk lave priser (< 100 kr. pr. booket dag)

**Regel (én kilde):** ny ren funktion `src/lib/fm/lowPriceGuard.ts` med `effektivDagspris(booking)` = aftalt total_price / antal bookede dage, ellers override, ellers lokationens daily_rate. Grænse 100 kr. som konstant samme sted. Test `lowPriceGuard.test.ts` (99 kr. kræver begrundelse, 100 kr. gør ikke, total 300 kr. over 3 dage = 100 → ok, 0 dage håndteres).

**Booking (opret og redigér):**
- `src/components/vagt-flow/EditBookingDialog.tsx` og oprettelsesflowet i `src/pages/vagt-flow/BookWeekContent.tsx`: når prisen er under grænsen, vises et påkrævet begrundelsesfelt; Gem er spærret uden tekst. Begrundelsen gemmes i `booking.price_note`.
- Infotekst ved prisfeltet: "Beløbet trækkes én gang i din DB i den lønperiode, aktiviteten ligger i. At det betales via Corpay, påvirker ikke din DB. Indtast den reelle pris."
- Serverhåndhævelse: udvid eksisterende pris-trigger (`booking_log_price_change`/`booking_enforce_quoted_price`) så en pris under grænsen uden `price_note` afvises med fejlkode, og begrundelsen skrives i `booking_price_audit` (ny kolonne `reason text`, nullable). Eksisterende rækker berøres ikke (trigger kun ved INSERT/ændring af pris).

**Lokation:** `src/pages/vagt-flow/LocationDetail.tsx` / `LocationsContent.tsx`: daily_rate under 100 kr. kræver begrundelse, gemt i ny nullable kolonne `location.daily_rate_note`, samme infotekst.

**Datakvalitet:** `src/hooks/useDbDataQuality.ts` + `src/components/salary/DbDataQualityPanel.tsx` får ny kategori "Booking-pris under 100 kr./dag" for indeværende og forrige lønperiode (15.→14., via eksisterende periodehelper), med link til bookingen og evt. begrundelse. Kun læsning, samme RLS som i dag.

## Del 2 – Eesy-refusion på direkte afregnede lokationer

- Nye valgfrie kolonner på `location`: `gross_daily_rate numeric`, `refund_daily_rate numeric`, `refund_client_id uuid` (FK clients, standard Eesy FM sat i UI, ikke hardkodet i DB).
- `daily_rate` er fortsat NETTO og eneste værdi DB-beregningen bruger. `booking_gross_amount`, `bookingGross`, `useClientDbData` røres ikke.
- UI: felter "Pris til lokationen (brutto) pr. dag", "Refusion pr. dag", "Refunderes af" i lokationsredigering. Advarsel (ikke blokering) hvis brutto − refusion ≠ daily_rate.
- Visning: ny lille komponent `RefusionLinje` brugt i `LocationDetail.tsx` og `BookingEconomySummary.tsx`: "Vi betaler 1.750 · Eesy refunderer 750 · Netto 1.000". For Coop-kæder bygges samme linje ud fra eksisterende regel i `location_rate_surcharges` via `useLocationRateSurcharges.ts`.
- Leverandørrapporten ændres ikke.

## Ekstra fejl – intern sektion sendes til leverandør

`supabase/functions/send-supplier-report/index.ts` linje 359: manuel afsendelse har `includeSurcharge: true`, så "Merpris og refusion / Til refusion fra …" kommer med i leverandørens mail. Ændres til `false` (ingen andre ændringer). Den automatiske afsendelse (linje 258, styret af `include_surcharge_summary`) bevares uændret. Deno-test der viser at manuel mail ikke indeholder sektionen; ingen faktisk afsendelse. Kræver deploy af funktionen.

## Migrationer (én, additiv)

```text
ALTER TABLE booking_price_audit ADD COLUMN reason text;
ALTER TABLE location ADD COLUMN daily_rate_note text,
  ADD COLUMN gross_daily_rate numeric, ADD COLUMN refund_daily_rate numeric,
  ADD COLUMN refund_client_id uuid REFERENCES clients(id);
CREATE OR REPLACE trigger-funktion: afvis pris < 100/dag uden price_note, log reason.
CHECK: refund_daily_rate >= 0, gross_daily_rate >= 0.
```
Ingen nye tabeller, ingen ny RLS/anon-adgang, ingen SECURITY DEFINER. Eksisterende rækker uændrede.

## Uafklaret / bekræftes ved byg
- Om bookinger med 1 kr. allerede i drift skal låses ved næste redigering (planen: ja, begrundelse kræves først når prisen ændres eller bookingen gemmes).
- Præcis oprettelsesflow ud over BookWeekContent kortlægges før byg; alle steder bruger samme guard.
