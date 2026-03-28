

## Plan: GDPR Security Hardening — Shared Auth Guard

### Hvad der bygges

En centraliseret auth-helper der bruges af alle tre GDPR edge functions. Ingen forretningslogik ændres — kun adgangskontrol tilføjes.

### Filer

| Fil | Handling |
|-----|---------|
| `supabase/functions/_shared/gdpr-auth.ts` | **Ny** — shared auth helper |
| `supabase/functions/gdpr-export-data/index.ts` | Tilføj auth-guard efter CORS |
| `supabase/functions/gdpr-process-deletion/index.ts` | Tilføj auth-guard efter CORS |
| `supabase/functions/gdpr-data-cleanup/index.ts` | Tilføj auth-guard efter CORS |
| `supabase/config.toml` | Tilføj 3 function blocks med `verify_jwt = false` |

### 1. Shared helper: `_shared/gdpr-auth.ts`

Eksporterer `authorizeGdprRequest(req)` som:
- Tjekker `x-gdpr-cron-token` header mod env var `GDPR_CRON_TOKEN` → tillader cron-kald
- Ellers læser `Authorization: Bearer <token>`, kalder `supabase.auth.getUser()`, tjekker `is_owner()` RPC
- Returnerer `{ caller: "cron" | "owner:email" }` ved succes
- Returnerer en `Response` med 401 (ingen/ugyldig auth) eller 403 (ikke-owner)

### 2. Integration i de tre funktioner

Ét kald tilføjes lige efter CORS-check i hver funktion:

```typescript
import { authorizeGdprRequest } from "../_shared/gdpr-auth.ts";

// efter OPTIONS check:
const authResult = await authorizeGdprRequest(req);
if (authResult instanceof Response) return authResult;
// authResult.caller logges i triggered_by
```

Al eksisterende forretningslogik forbliver uændret. Fejlresponses generiske (ingen stack traces).

### 3. Config

```toml
[functions.gdpr-export-data]
verify_jwt = false

[functions.gdpr-process-deletion]
verify_jwt = false

[functions.gdpr-data-cleanup]
verify_jwt = false
```

`verify_jwt = false` fordi vi validerer manuelt i koden (nødvendigt for at understøtte cron-token).

### 4. Env var

`GDPR_CRON_TOKEN` — en tilfældig secret string. Sættes via secrets-tool. Bruges af scheduler/cron til at kalde funktionerne uden bruger-login.

### Udrulning
1. Sæt `GDPR_CRON_TOKEN` secret
2. Funktionerne deployes automatisk
3. Eksisterende cron-jobs skal opdateres til at inkludere `x-gdpr-cron-token` header (hvis der tilføjes cron-jobs fremover)

### Testplan
- Kald uden auth → 401
- Kald med korrekt cron-token → success
- Kald med gyldig owner JWT → success
- Kald med ikke-owner JWT → 403
- Kald med forkert cron-token → 401

