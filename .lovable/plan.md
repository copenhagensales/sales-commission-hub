
# Fix: Enrichment-healer kan ikke finde Adversus credentials

## Problem

Healeren fejler med "No Adversus API key found, skipping all" fordi:

1. **Forkert credential-key**: Healeren soeger efter `credentials.api_key` eller `credentials.apiKey` (linje 82), men Adversus credentials er gemt som `{ username, password }` eller `{ ADVERSUS_API_USERNAME, ADVERSUS_API_PASSWORD }`.
2. **Forkert auth-metode**: Healeren bruger `Bearer ${apiKey}` (linje 105), men Adversus API kraever Basic Auth (`Basic ${btoa(username:password)}`).

Integration-engine adapteren haandterer dette korrekt (linje 40-50 i adversus.ts), men healeren har sin egen separate implementation der ikke matcher.

## Loesning

Opdater `healAdversus()` i `supabase/functions/enrichment-healer/index.ts`:

### Aendring 1: Credential-udtrækning (linje 82-86)

Foer:
```typescript
const apiKey = credentials?.api_key || credentials?.apiKey;
if (!apiKey) {
  log("No Adversus API key found, skipping all");
  return { healed: 0, failed: 0, skipped: sales.length };
}
```

Efter:
```typescript
const user = credentials?.username || credentials?.ADVERSUS_API_USERNAME;
const pass = credentials?.password || credentials?.ADVERSUS_API_PASSWORD;
if (!user || !pass) {
  log("No Adversus credentials found (need username+password), skipping all");
  return { healed: 0, failed: 0, skipped: sales.length };
}
const authHeader = "Basic " + btoa(`${user}:${pass}`);
```

### Aendring 2: Auth-header i API-kald (linje 105)

Foer:
```typescript
headers: { Authorization: `Bearer ${apiKey}` },
```

Efter:
```typescript
headers: { Authorization: authHeader },
```

### Hvad dette loeser

- Healeren kan nu korrekt laese Adversus credentials (username/password)
- API-kald bruger Basic Auth i stedet for Bearer token
- Lead data (Tilskud, Sales ID, Bindingsperiode osv.) bliver hentet og gemt i `raw_payload`
- "Sync enkelt salg" knappen vil nu faktisk heale salget i stedet for at skippe det
