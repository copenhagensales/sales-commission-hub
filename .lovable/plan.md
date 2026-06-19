## Konklusion
SMS-flowet kan i dag vise en grøn “sendt” besked, selv om Twilio kun har accepteret den til kø — ikke nødvendigvis leveret den til modtageren. Derfor kan Isabella mangle SMS’en, mens Stork stadig ser ud som om alt er OK.

## Evidens fra koden
- `supabase/functions/send-recruitment-sms/index.ts:63-80` sender SMS til Twilio og returnerer først fejl, hvis Twilio afviser selve oprettelsen.
- `supabase/functions/send-recruitment-sms/index.ts:108-120` gemmer beskeden i `communication_logs` med `delivery_status: twilioResult.status || 'queued'`. `queued` er ikke leveret.
- `supabase/functions/twilio-sms-status/index.ts:66-70` opdaterer `communication_logs` senere via `twilio_sid`, når Twilio melder `sent`, `delivered`, `undelivered` eller `failed`.
- `src/components/recruitment/SendSmsDialog.tsx:238-286` viser faktisk leveringsstatus i SMS-dialogen.
- Men screenshot’et matcher `src/pages/recruitment/Messages.tsx:649-699`, og den samtalevisning viser kun tekst + tidspunkt — ikke `delivery_status`, fejl eller “ikke leveret”.

## Plan
1. **Verificér Isabella-beskeden i data/logs**
   - Slå den konkrete udgående SMS op i `communication_logs` ud fra tidspunkt/indhold/telefon.
   - Tjek `twilio_sid`, `delivery_status`, `delivery_error_code`, `delivery_error_message`.
   - Tjek edge function logs for `send-recruitment-sms` og `twilio-sms-status` omkring samme tidspunkt.

2. **Ret hovedvisningen for rekrutterings-SMS**
   - Udvid `Message`-typen i `src/pages/recruitment/Messages.tsx` med:
     - `delivery_status`
     - `delivery_error_code`
     - `delivery_error_message`
   - Vis samme leveringsindikator som i `SendSmsDialog` direkte i samtalen:
     - `queued/sent` = afventer/sendt
     - `delivered` = leveret
     - `undelivered/failed` = ikke leveret + fejltekst/kode

3. **Gør “Svar” mindre falsk-trygt**
   - Efter afsendelse skal brugeren se status som “Afventer levering” i stedet for bare en grøn boble.
   - Hvis status senere bliver `undelivered` eller `failed`, skal beskeden markeres tydeligt i samtalen.

4. **Valider callback-kæden**
   - Bekræft at `twilio-sms-status` faktisk modtager status callbacks og matcher rækker via `twilio_sid`.
   - Hvis konkrete Isabella-SMS ikke har fået callback, er næste fix at sikre status-callback URL/konfiguration — ikke UI.

## Afgrænsning
- Ingen ændring af SMS-templates, booking-flow eller Twilio credentials.
- Ingen DB-skemaændring medmindre verificeringen viser, at statusfelterne mangler i aktiv database.
- Ingen ændring af medarbejder-SMS, medmindre samme fejl bekræftes dér bagefter.