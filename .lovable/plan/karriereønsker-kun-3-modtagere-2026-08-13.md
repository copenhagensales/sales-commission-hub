# Karriereønsker: kun 3 modtagere

Notifikationsmails for nye karriereønsker skal kun sendes til:

- oscar@copenhagensales.dk
- km@copenhagensales.dk
- mg@copenhagensales.dk

De øvrige (ws@, lm@, jm@) skal ikke længere modtage dem.

## Ændring

I `supabase/functions/send-career-wish-notification/index.ts` erstattes rolle-opslaget (`system_roles` + medarbejderdata + auth-fallback) med en fast modtagerliste øverst i filen:

```ts
const RECIPIENTS = [
  "mg@copenhagensales.dk",
  "km@copenhagensales.dk",
  "oscar@copenhagensales.dk",
];
```

`getRecipients()` fjernes, og udsendelsesløkken bruger listen direkte. Resten af funktionen (mailindhold, logning, svar) er uændret.

Fordel: listen er let at rette senere, og der sendes aldrig mails til nye ejere/rekrutterings-brugere ved en fejl.
