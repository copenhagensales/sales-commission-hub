

# Notifikationer/Alerts ved kritiske taerskler

## Oversigt

Tilfoej et alert-system til SystemStability-dashboardet der automatisk viser advarsler naar metrics overskrider kritiske taerskler. Alerts vises bade som en persistent banner-sektion oeverst paa siden og som sonner-toasts naar nye kritiske tilstande detekteres.

---

## Implementering

### 1. Ny komponent: `AlertBanner.tsx`

Oprettes i `src/components/system-stability/AlertBanner.tsx`.

En Card-komponent der viser aktive alerts i en liste med farve-kodning:

- **Kritisk (rod):** 429-rate > 10%, succes-rate < 80%, budget > 90%
- **Advarsel (gul):** 429-rate > 5%, succes-rate < 95%, budget > 70%, ingen sync i > 30 min
- **Info:** Integration har haft 3+ fejl i traek

Hver alert viser: ikon, integration-navn, besked, og tidspunkt.

Banneret skjules automatisk naar der ingen aktive alerts er.

### 2. Custom hook: `useStabilityAlerts.ts`

Oprettes i `src/hooks/useStabilityAlerts.ts`.

Modtager `integrationMetrics`, `budgetUsed15m`, `budgetUsed60m` og returnerer en liste af aktive alerts.

Bruger `useRef` til at tracke "allerede vist"-alerts saa sonner-toasts kun fires een gang pr. ny kritisk tilstand (ikke ved hvert 30s refetch).

**Taerskler (konfigurerbare):**

| Metric | Advarsel | Kritisk |
|--------|----------|---------|
| 429-rate (15m) | > 5% | > 10% |
| Succes-rate (1t) | < 95% | < 80% |
| Budget brugt (15m) | > 70% | > 90% |
| Budget brugt (60m) | > 70% | > 90% |
| Tid siden sidste sync | > 30 min | > 60 min |
| Konsekutive fejl | >= 3 | >= 5 |

### 3. Sonner toast-notifikationer

Naar en ny kritisk alert detekteres (ikke set foer), fyrer hooket en `toast.error()` eller `toast.warning()` via sonner, saa brugeren faar besked selv hvis de har scrollet vaek fra alert-banneret.

### 4. Integration i SystemStability.tsx

- Importer `useStabilityAlerts` hook og `AlertBanner` komponent
- Placer `AlertBanner` lige under header-sektionen (foer status cards)
- Pass integrationMetrics og budget-data til hooket

---

## Tekniske detaljer

### AlertBanner props interface
```typescript
interface StabilityAlert {
  id: string;           // unik noegle (fx "429-rate-{integrationId}")
  level: "critical" | "warning" | "info";
  integration: string;  // integration-navn
  message: string;      // fx "429-rate er 12.3% (taerskel: 10%)"
  metric: string;       // fx "rateLimitRate15m"
  value: number;
  threshold: number;
}
```

### Filer der oprettes
- `src/hooks/useStabilityAlerts.ts` -- hook der beregner alerts og fyrer toasts
- `src/components/system-stability/AlertBanner.tsx` -- visuel alert-liste

### Filer der redigeres
- `src/pages/SystemStability.tsx` -- tilfoej hook + banner i render

### Ingen database-aendringer
Alt beregnes client-side fra eksisterende data (integrationMetrics + budget).

