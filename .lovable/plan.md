

# Direkte til forhåndsvisning efter upload (når config eksisterer)

## Problem
Når en klient allerede har en gemt opsætning, viser step 2 stadig filinformation efter upload i stedet for at gå direkte til preview. Auto-match kører, men brugeren ser fortsat upload-trinnet med "Matcher..." tekst.

## Løsning

**Fil: `src/components/cancellations/UploadCancellationsTab.tsx`**

1. **I `onDrop`**: Når en default config findes og filen er parsed, kald `handleMatch()` direkte (i stedet for at sætte `autoMatchPending` flag). `handleMatch` sætter allerede `setStep("preview")` ved afslutning.

2. **Fjern mellemtilstand**: Den tredje gren i step 2 (linje 1067-1081 — viser filnavn + "Matcher...") er unødvendig når config eksisterer, da brugeren aldrig skal se den. Auto-match bør ske umiddelbart og skifte direkte til preview.

3. **Sikre `handleMatch` kører korrekt**: `handleMatch` afhænger af at `phoneColumn`/`oppColumn` etc. allerede er sat via `applyConfig`. Da `useEffect` for auto-match allerede håndterer dette via `autoMatchPending`, skal vi sikre at state er opdateret inden match starter. Behold `autoMatchPending` pattern men verificér at `setStep("preview")` altid kaldes i `handleMatch`.

Resultatet: Upload fil → auto-match kører → preview vises. Brugeren ser aldrig step 2's "fil uploadet" tilstand.

