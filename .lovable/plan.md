

# Fix: "Cannot access 'provider' before initialization"

## Problem
En JavaScript "temporal dead zone" (TDZ) fejl forhindrer ALLE syncs i at koere. Fejlen opstod under den seneste refactoring, hvor `const provider` blev deklareret to gange i samme `try`-blok i `sync-integration.ts`:

- **Linje 108:** `const provider = ...` (udenfor try-blokken -- OK)
- **Linje 234:** `const provider = ...` (inde i try-blokken -- overskygger den ydre)
- **Linje 155:** `checkProviderQuota(supabase, provider)` (inde i try-blokken -- rammer TDZ)

Resultat: Alle 5 integrationer (Lovablecph, Relatel, Eesy, Tryg, ASE) fejler med "Cannot access 'provider' before initialization" siden kl. ~07:30 (foerste forsog efter nat-pause).

## Loesning

Omdoeb den duplikerede variabel pa linje 234 til noget andet, fx `providerForRateCheck`:

```typescript
// Linje 234 - aendres fra:
const provider = (source || integration.provider || "").toLowerCase();

// til:
const providerForRateCheck = (source || integration.provider || "").toLowerCase();
```

Og opdater alle referencer til denne variabel i den omgivende blok (linje 235-249) til at bruge `providerForRateCheck`.

## Teknisk detalje

I JavaScript har `const`/`let` block-scoping. Inde i `try { }`-blokken (linje 153-?) overskygger `const provider` pa linje 234 den ydre `const provider` fra linje 108. Men da den indre deklaration foerst initialiseres pa linje 234, er enhver reference til `provider` foer linje 234 (men inde i try-blokken) i "temporal dead zone", hvilket udloeser en ReferenceError.

## Filer der aendres

1. `supabase/functions/integration-engine/actions/sync-integration.ts` -- omdoeb duplikeret variabel
2. Deploy: `integration-engine`

## Effekt

Alle 5 integrationer vil genoptage normal sync umiddelbart efter deploy. Ingen data er tabt -- watermarks sikrer at morgen-sync henter alt fra sidste succesfulde klokkeslaet (ca. kl. 23:00 i gar).

