
# Fix: bil-aflevering gemmer, men Thomas-notifikation bliver ikke sendt

## Hvad jeg har fundet
- Afleveringen bliver faktisk gemt i databasen (seneste række er oprettet kl. 09:04 med foto)
- Thomas Wehage er korrekt sat op som assistant leader for **Fieldmarketing**
- M365-secrets findes
- Der er stadig **ingen request-logs** til `notify-vehicle-returned`

Det peger på, at problemet sandsynligvis er i selve browser-kaldet til funktionen — og at fejlen lige nu bliver skjult, fordi UI’et gemmer afleveringen og derefter **sluger mail-fejlen stille**

## Løsning
Jeg vil gøre flowet robust ved at flytte den kritiske logik væk fra “gem først, prøv så mail bagefter i stilhed”.

### Filer
- `src/pages/vagt-flow/MyBookingSchedule.tsx`
- `supabase/functions/notify-vehicle-returned/index.ts`
- `supabase/config.toml`

## Plan
1. **Gør `notify-vehicle-returned` til det primære backend-kald**
   - Funktionen skal modtage booking/vehicle/date/photo_url
   - Den skal selv slå den aktuelle medarbejder op via auth
   - Den skal selv oprette/upserte `vehicle_return_confirmation`
   - Derefter sende mail til Thomas/øvrige FM-assistant leaders i samme flow

2. **Fjern den stille fejl i frontend**
   - `MyBookingSchedule.tsx` skal ikke længere gemme afleveringen direkte og bagefter ignorere mail-fejl
   - Frontend skal i stedet kalde funktionen og kun vise fuld succes når både backend-oprettelse og notifikation er håndteret
   - Hvis afleveringen er gemt men mail fejler, skal brugeren få en tydelig advarsel i stedet for et falsk grønt succes-signal

3. **Tilføj rigtig observability i edge-funktionen**
   - Log start, input, fundne modtagere, og om Graph-mailen blev accepteret
   - Returnér struktureret svar som fx `{ ok, confirmed, notified, recipients }`
   - Så vi fremover kan se præcist om problemet er auth, recipient lookup eller mail-send

4. **Gør funktionen eksplicit beskyttet**
   - Tilføj en tydelig config for funktionen i `supabase/config.toml`
   - Så auth-adfærd ikke er implicit/tvetydig

## Teknisk detalje
Den nuværende kode gør dette:

```text
UI:
1. upload foto
2. upsert vehicle_return_confirmation
3. prøv notify-vehicle-returned
4. slug fejl
5. vis succes-toast alligevel
```

Jeg vil ændre det til:

```text
UI:
1. upload foto
2. kald notify-vehicle-returned

Backend-funktion:
1. validér auth
2. find employee + navn
3. upsert vehicle_return_confirmation
4. find FM assistant leaders
5. send mail
6. returnér status til UI
```

## Resultat
- Thomas-notifikationen bliver en del af samme sikre backend-flow
- Vi undgår “afleveret = ja, men mail = måske”
- Brugeren får korrekt feedback, hvis mailen fejler
- Fejlen kan spores hurtigt næste gang i logs
