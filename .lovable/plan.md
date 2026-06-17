## Diagnose (evidens)

Den manglende SMS til Nellie (`+4521525265`) er fundet. Twilio's eget log siger:

```
3. jun. 2026 15:18  SID SM25f55f949c51b414ceafac25abbf50c4
  status = undelivered
  error_code = 30008  ("Unknown error" — typisk operatør-/spam-filtrering)
  body = "Dejligt at høre, vi sidder og har en mulig opstartsdato - Har du tid til et kald?"
```

Den tidligere SMS samme dag kl. 09:49 (SID `SMab71…155f1c`) blev `delivered` normalt. Alle 36 andre udgående SMS fra de seneste dage står som `delivered` hos Twilio. Det er altså **ikke et generelt nedbrud** — kun denne ene besked blev afvist af modtagerens carrier.

**Twilio 30008** betyder "ukendt fejl meldt af modtagerens operatør". Mest almindelige årsager i DK:
- Operatøren har spam-filtreret beskeden (indholdet, afsender-nummeret, eller frekvensen)
- Modtagerens telefon var midlertidigt uden netværk over længere tid
- Modtagerens nummer er midlertidigt blokeret for A2P-trafik

Der er **ingen kode-fejl** i `send-recruitment-sms` — funktionen sendte beskeden korrekt, Twilio modtog den, men operatøren afviste leveringen.

## Det egentlige problem

Stork har ingen **leveringsstatus-tracking**:

- `send-recruitment-sms/index.ts` (linje 105-117) gemmer kun `twilio_sid` i `communication_logs`. Der gemmes ikke `status` eller `error_code`.
- Der er ingen `StatusCallback` parameter på Twilio-kaldet (linje 54-57), så Twilio sender aldrig opdateringer om delivered/undelivered tilbage.
- `communication_logs` har ingen kolonner til status.
- UI'et (`SendSmsDialog.tsx`) viser kun "SMS sendt" i en toast og rendrer beskeden som leveret — uanset om den senere fejler.

Resultat: Oscar/Mathias skrev til Nellie 3. juni 15:18, fik "SMS sendt"-bekræftelse, men Nellie modtog aldrig beskeden, og I havde ingen måde at se det på.

## Forslag — to dele

### Del 1: Informér om den konkrete sag (ingen kode)
Send beskeden igen til Nellie. Hvis den igen fejler med 30008, ring til hende — hendes operatør har sandsynligvis filtreret afsender-nummeret.

### Del 2: Tilføj leveringsstatus-tracking (kode)

Zone: **gul** (recruitment/SMS, ikke løn/pricing/GDPR). Følger arkitekturen i bibel/CLAUDE.md.

1. **Migration** på `communication_logs`:
   - `delivery_status text` (`queued` | `sent` | `delivered` | `undelivered` | `failed`)
   - `delivery_error_code text`
   - `delivery_error_message text`
   - `delivery_updated_at timestamptz`
   - Index på `twilio_sid` for hurtigt opslag i webhook.

2. **`send-recruitment-sms/index.ts`**:
   - Tilføj `StatusCallback` parameter der peger på en ny edge function `twilio-sms-status`.
   - Sæt `delivery_status='queued'` ved insert.

3. **Ny edge function `twilio-sms-status`** (public, ingen JWT — Twilio kalder den):
   - Modtager form-encoded webhook fra Twilio med `MessageSid`, `MessageStatus`, `ErrorCode`.
   - Opdaterer matching række i `communication_logs` via service role.

4. **`SendSmsDialog.tsx`**:
   - Vis leveringsstatus pr. udgående besked: ✓ leveret, ⏳ sendt (afventer), ⚠ ikke leveret (med fejlkode).
   - Hvis `undelivered`/`failed`: rød advarsel + tooltip med fejlbeskrivelse.

5. **`receive-sms`** og `send-employee-sms` får samme behandling i samme migration/PR (samme tabel, samme problem).

### Forbedring der ikke er en lap
Dette gør systemet stærkere (princip 5): I ser nu altid om en SMS faktisk når frem, ikke kun om den blev afsendt. Ingen flere blinde vinkler hvor en kandidat ghoster fordi de aldrig fik beskeden.

## Hvad jeg IKKE foreslår
- Ingen retry-logik automatisk (kan duplikere beskeder hvis status er forsinket).
- Ingen ændring af Twilio-nummer eller A2P-registrering (større beslutning, kræver evaluering).
- Ingen ændring af `applications`/candidate-relation (separat problem — `application_id` er altid `null` for Nellie fordi der ikke findes en `applications`-række, men SMS'erne vises korrekt alligevel via phone_number-match).

## Beslutning du skal tage
Vil du have begge dele (informering + tracking-implementation), kun informeringen, eller en lettere version (fx kun `delivery_status` uden UI-visning endnu)?