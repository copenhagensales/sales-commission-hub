## Årsag

`send-employee-invitation` bygger linket via `Deno.env.get("PUBLIC_APP_URL")`. Secret'en `PUBLIC_APP_URL` er sat til et Lovable-domæne, så alle invitationsmails peger på Lovable i stedet for Stork. Fallback i koden er allerede korrekt (`https://stork.copenhagensales.dk`) — problemet er secret-værdien, ikke koden.

Evidens: `supabase/functions/send-employee-invitation/index.ts:155-159`.

## Løsning

1. Opdater secret `PUBLIC_APP_URL` til `https://stork.copenhagensales.dk` via `secrets--update_secret`. Ingen kodeændringer nødvendige — funktionen læser secret'en runtime.
2. Send ny invitation til Carl så han får et link der peger korrekt på Stork.

Bemærk: `send-contract-reminders` bruger samme secret med Lovable-fallback — den vil også bruge Stork efter opdateringen, hvilket er ønsket.

## Ikke i scope

- Ingen kodeændringer.
- Rører ikke reset-password funktionerne (de har allerede hardkodet Stork).
