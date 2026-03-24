

# Fix: Case-insensitiv medlemsnummer-lookup i cancellation matching

## Problem
`raw_payload.data` kan indeholde enten `medlemsnummer` (lowercase, ældre salg) eller `Medlemsnummer` (Title Case, nyere salg efter normalisering). Koden søger kun efter `Medlemsnummer` — og misser alle salg med lowercase nøgle.

## Løsning

| Fil | Ændring |
|-----|---------|
| `src/components/cancellations/UploadCancellationsTab.tsx` | Erstat direkte property-access `rp?.data?.Medlemsnummer` med en case-insensitiv lookup-funktion. Anvend på begge steder (linje ~389-393 og ~491-493). |

## Konkret ændring

Tilføj en hjælpefunktion:
```typescript
function getCaseInsensitive(obj: Record<string, unknown> | undefined, key: string): unknown {
  if (!obj) return undefined;
  const lowerKey = key.toLowerCase();
  for (const k of Object.keys(obj)) {
    if (k.toLowerCase() === lowerKey) return obj[k];
  }
  return undefined;
}
```

Erstat:
```typescript
(rp?.data as ...)?.Medlemsnummer
```
Med:
```typescript
getCaseInsensitive(rp?.data as Record<string, unknown> | undefined, "medlemsnummer")
```

Dette sikrer at både `medlemsnummer`, `Medlemsnummer` og evt. andre varianter matches korrekt.

