

# Ret enrichment-healer Enreach credential-logik

## Problem
`healEnreach()` i `enrichment-healer/index.ts` (linje 181-186) soeger efter `credentials.api_key` eller `credentials.apiKey` og bruger `Bearer`-auth. Men de faktiske Enreach-credentials bruger `username`/`password` (Basic Auth) eller `api_token` -- praecis som `EnreachAdapter` i integration-engine haandterer det.

## Loesning
Erstat credential-udtrak og auth-header-opbygning i `healEnreach()` med samme heuristik som `EnreachAdapter` (linje 73-87):

1. Hvis `username` + `password` findes: brug `Basic btoa(user:pass)`
2. Ellers hvis `api_token` findes og indeholder `:`: brug `Basic btoa(token)`
3. Ellers hvis `api_token` findes: brug `Bearer token`
4. Hvis intet matcher: skip med fejlbesked

## AEndringer

### Fil: `supabase/functions/enrichment-healer/index.ts`

Erstat linje 181-186 i `healEnreach()`:

```typescript
// FRA (forkert):
const apiKey = credentials?.api_key || credentials?.apiKey;
const apiUrl = integration?.api_url || credentials?.api_url || "https://api.herobase.com";
if (!apiKey) {
  log("No Enreach API key found, skipping all");
  return { healed: 0, failed: 0, skipped: sales.length };
}

// TIL (samme heuristik som EnreachAdapter):
let apiUrl = integration?.api_url || credentials?.api_url || "https://wshero01.herobase.com/api";
// Sanitize and normalize URL (same as EnreachAdapter)
apiUrl = apiUrl.replace(/^(Web|URL|API|Endpoint):\s*/i, '').trim();
if (!apiUrl.startsWith('http://') && !apiUrl.startsWith('https://')) {
  apiUrl = 'https://' + apiUrl;
}
if (apiUrl.endsWith('/')) apiUrl = apiUrl.slice(0, -1);
if (!apiUrl.endsWith('/api')) apiUrl = apiUrl + '/api';

let authHeader: string;
const user = credentials?.username;
const pass = credentials?.password;
const apiToken = credentials?.api_token;

if (user && pass) {
  authHeader = "Basic " + btoa(`${user}:${pass}`);
} else if (apiToken && apiToken.includes(':')) {
  authHeader = "Basic " + btoa(apiToken);
} else if (apiToken) {
  authHeader = `Bearer ${apiToken}`;
} else {
  log("No Enreach credentials found (need username+password or api_token), skipping all");
  return { healed: 0, failed: 0, skipped: sales.length };
}
```

Erstat ogsaa fetch-headeren (linje 205-206) til at bruge den nye `authHeader` og tilfoej fair-use-headeren:

```typescript
// FRA:
headers: { Authorization: `Bearer ${apiKey}`, "X-Rate-Limit-Fair-Use-Policy": "Minute rated" },

// TIL:
headers: { Authorization: authHeader, "X-Rate-Limit-Fair-Use-Policy": "Minute rated" },
```

Ret ogsaa default API-URL til `simpleleads`-endpointet (linje 204). Da `apiUrl` nu ender paa `/api`, bliver URL'en korrekt: `${apiUrl}/simpleleads?UniqueId=...`.

### Forventet effekt
- Enrichment-healeren kan nu autentificere mod Enreach med de faktiske credentials (username/password)
- De 383+ pending Enreach-salg vil begynde at blive healet ved naeste koersel
- Samme URL-sanitering som adapteren sikrer korrekt endpoint

