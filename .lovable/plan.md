

# Fix: Circuit Breaker variabelfejl

## Problem
I filen `supabase/functions/integration-engine/utils/circuit-breaker.ts`, funktion `recordCircuitBreakerFailure`:

- **Linje 76**: Variablen defineres som `let pauseMinutes: number | null = null;`
- **Linje 98**: Return-objektet refererer til `pausedMinutes` (med 'd')

JavaScript/TypeScript shorthand `{ newCount, pausedMinutes }` leder efter en variabel kaldet `pausedMinutes`, men den hedder `pauseMinutes`. Det giver `ReferenceError: pausedMinutes is not defined` hver gang en integration er rate-limited.

## Konsekvens
Alle Enreach-integrationer (Tryg, Eesy, ASE) crasher i circuit breaker-logikken efter 429-fejl. Det resulterer i dobbelte sync runs (en success + en error) og forhindrer korrekt circuit breaker-pause.

## Fix
En enkelt linje-rettelse i `circuit-breaker.ts`:

Ret variabelnavnet fra `pauseMinutes` til `pausedMinutes` (linje 76), ELLER ret return-objektet til at bruge det korrekte variabelnavn. Den nemmeste fix er at omdobe variablen:

```text
Fil: supabase/functions/integration-engine/utils/circuit-breaker.ts

Linje 76: let pauseMinutes  -->  let pausedMinutes
Linje 78-82: pauseMinutes references  -->  pausedMinutes
Linje 84-85: pauseMinutes references  -->  pausedMinutes
```

Specifikt:
- `let pauseMinutes` bliver til `let pausedMinutes`
- `pauseMinutes = level.pauseMinutes` bliver til `pausedMinutes = level.pauseMinutes`
- `const pausedUntil = pauseMinutes` bliver til `const pausedUntil = pausedMinutes`

Herefter redeploy `integration-engine` edge function.

## Forventet resultat
- Ingen flere `ReferenceError: pausedMinutes is not defined`
- Circuit breaker fungerer korrekt: pauser integrationer ved gentagne 429-fejl
- Enreach rate-limiting håndteres korrekt med automatisk backoff

