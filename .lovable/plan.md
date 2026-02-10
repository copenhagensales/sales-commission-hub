

## Godkend specifikke emails i API-filtrering

**Problem:** Systemet tillader kun emails fra tre domaner (`@copenhagensales.dk`, `@cph-relatel.dk`, `@cph-sales.dk`). De to Gmail-adresser bliver derfor filtreret fra i alle API-synkroniseringer.

**Losning:** Tilfoej en whitelist for specifikke email-adresser, der skal accepteres uanset domane.

### Emails der skal godkendes
- `kongtelling@gmail.com`
- `rasmusventura700@gmail.com`

### Filer der skal opdateres

Email-valideringen er duplikeret pa 6 steder. Alle skal opdateres:

1. **`src/lib/excluded-domains.ts`** - Frontend-kopi (central definition)
2. **`supabase/functions/integration-engine/core/users.ts`** - Bruger-sync
3. **`supabase/functions/integration-engine/core/sales.ts`** - Salgs-sync
4. **`supabase/functions/integration-engine/adapters/enreach.ts`** - Enreach (2 steder)
5. **`supabase/functions/integration-engine/adapters/adversus.ts`** - Adversus

### Aendring i hver fil

Tilfoej en `WHITELISTED_EMAILS`-liste og opdater `isValidSyncEmail`-funktionen:

```text
const WHITELISTED_EMAILS = [
  "kongtelling@gmail.com",
  "rasmusventura700@gmail.com",
];

function isValidSyncEmail(email) {
  if (!email) return false;
  const emailLower = email.toLowerCase();

  // Check exact whitelist first
  if (WHITELISTED_EMAILS.includes(emailLower)) return true;

  // Then excluded patterns
  if (EXCLUDED_EMAIL_PATTERNS.some(...)) return false;

  // Then domain check
  return VALID_EMAIL_DOMAINS.some(...);
}
```

### Risiko
Lav risiko. Det er en simpel tilfoejelse af en whitelist-check for validering. Ingen eksisterende funktionalitet pavirkes.

