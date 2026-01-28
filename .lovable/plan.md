
# Plan: Fix ASE API Sync - Ugyldig URL Format

## Problem Identificeret

ASE integrationen fejler med:
```
TypeError: Url scheme 'web' not supported
```

**Årsag**: `api_url` feltet i databasen indeholder:
```
Web: https://wshero01.herobase.com/
```

"Web: " prefixet er inkluderet i URL'en, så når EnreachAdapter konstruerer API URL'en, bliver den:
```
web: https://wshero01.herobase.com//api/simpleleads?...
```

`fetch()` prøver at bruge `web:` som URL scheme i stedet for `https:`.

---

## Løsning

### 1. Tilføj URL Sanitering i EnreachAdapter

**Fil:** `supabase/functions/integration-engine/adapters/enreach.ts`

Tilføj robust URL parsing der håndterer common input-fejl:

```typescript
constructor(credentials: EnreachCredentials, ...) {
  let providedUrl = credentials.api_url || "https://wshero01.herobase.com/api";
  
  // Sanitize URL: fjern common prefixes som "Web: ", "URL: ", etc.
  providedUrl = providedUrl.replace(/^(Web|URL|API):\s*/i, '').trim();
  
  // Sikr at URL starter med https://
  if (!providedUrl.startsWith('http://') && !providedUrl.startsWith('https://')) {
    providedUrl = 'https://' + providedUrl;
  }
  
  this.baseUrl = providedUrl.endsWith("/") ? providedUrl.slice(0, -1) : providedUrl;
  // ... rest af koden
}
```

### 2. (Valgfrit) Ret Data i Databasen

Alternativt kan ASE integrationens `api_url` rettes manuelt i Settings siden til:
```
https://wshero01.herobase.com/
```

---

## Teknisk Flow

```text
NUVÆRENDE (FEJLER):
  api_url: "Web: https://wshero01.herobase.com/"
      ↓
  baseUrl: "Web: https://wshero01.herobase.com//api"
      ↓
  fetch("Web: https://...") → TypeError: Url scheme 'web' not supported

EFTER FIX:
  api_url: "Web: https://wshero01.herobase.com/"
      ↓
  sanitize: "https://wshero01.herobase.com/"
      ↓
  baseUrl: "https://wshero01.herobase.com/api"
      ↓
  fetch("https://...") → SUCCESS
```

---

## Filer der ændres

| Fil | Ændring |
|-----|---------|
| `supabase/functions/integration-engine/adapters/enreach.ts` | Tilføj URL sanitering i constructor |

---

## Resultat

- ASE sync vil fungere korrekt uden at brugeren skal rette URL manuelt
- Robust mod fremtidige input-fejl med forkerte URL-formater
- Tilføjer logging så man kan se hvad der blev saniteret
