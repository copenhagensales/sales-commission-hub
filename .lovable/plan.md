## Mål
Kontrakt-emails skal altid linke til `https://stork.copenhagensales.dk/auth` i stedet for Lovable preview-domænet.

## Ændringer

**1. `supabase/functions/send-contract-email/index.ts`**
- Erstat fallback `https://jwlimmeijpfmaksvmuru.lovable.app` med `https://stork.copenhagensales.dk`.
- Hvis `appUrl` peger på et Lovable-domæne (`.lovable.app` / `.lovableproject.com`), ignorér det og brug produktionsdomænet.
- Behold `appUrl`-feltet i interface for bagudkompatibilitet.

**2. `src/components/contracts/SendContractDialog.tsx`**
- Erstat `appUrl: window.location.origin` med `appUrl: getPublicUrl()` (importeret fra `@/lib/getPublicUrl`), så afsenderen aldrig sender Lovable-preview-URL videre.

**3. Redeploy edge function** efter ændring.

## Ingen påvirkning
- Ingen DB-ændringer, ingen RLS, ingen pricing/løn.
- Grøn/gul zone.
