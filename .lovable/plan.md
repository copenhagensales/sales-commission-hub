

# Plan: Komplet Optimering og Stabilitetsforbedring

## Overblik

Denne plan samler alle identificerede problemer i én implementering fordelt på **7 hovedkategorier**:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│  KATEGORI                           │ PÅVIRKNING                            │
├─────────────────────────────────────┼───────────────────────────────────────┤
│  1. Login Events Bloat (KRITISK)    │ 218 MB bloat, 34.000 events/dag       │
│  2. FM Migration Ufuldstændig       │ 21 filer, duplikerede queries         │
│  3. Risiko for .single() Fejl       │ 93 filer, potentiel crash             │
│  4. Debug Console.log i Produktion  │ 335+ steder, performance overhead     │
│  5. Manglende QueryClient Config    │ Ingen retry/error handling config     │
│  6. Aggressive Polling Intervaller  │ Unødvendig DB-belastning              │
│  7. Døde Tabeller og Cleanup        │ 30+ tomme tabeller, 248 MB logs       │
└─────────────────────────────────────┴───────────────────────────────────────┘
```

---

## Kategori 1: Login Events Bloat (KRITISK)

### Rodårsager Identificeret

| Problem | Konsekvens |
|---------|------------|
| Session ID bruger JWT header (identisk for alle) | Deduplication virker ikke |
| 43 filer kalder useAuth() | ~85 events per page load |
| TOKEN_REFRESHED udløser logging | Events ved hver token refresh |
| getSession() callback logger også | Dobbelt logging ved mount |

### Løsning

**1.1 Fix session_id generering:**
```typescript
// FRA (alle JWTs starter med samme header):
const sessionKey = `${currentSession.user.id}-${currentSession.access_token.substring(0, 20)}`;

// TIL (unik signatur per session):
const sessionKey = `${currentSession.user.id}-${currentSession.access_token.slice(-20)}`;
```

**1.2 Kun log ved faktiske logins:**
```typescript
// FRA:
if (session && (event === "SIGNED_IN" || event === "TOKEN_REFRESHED")) {
  logLoginEvent(session);
}

// TIL:
if (session && event === "SIGNED_IN") {
  logLoginEvent(session);
}
```

**1.3 Fjern getSession() logging:**
```typescript
// FRA (linje ~140):
if (session?.user?.email) {
  logLoginEvent(session);  // <-- Fjern denne
  ...
}

// TIL:
if (session?.user?.email) {
  // Ingen logLoginEvent - onAuthStateChange håndterer SIGNED_IN
  setTimeout(() => {
    checkMustChangePassword(session.user.email);
  }, 0);
}
```

**1.4 Edge function duplicate check:**
```typescript
// I log-login-event/index.ts - tilføj før insert:
const { data: existing } = await supabaseClient
  .from("login_events")
  .select("id")
  .eq("user_id", user_id)
  .eq("session_id", session_id)
  .maybeSingle();

if (existing) {
  return new Response(JSON.stringify({ success: true, duplicate: true }), ...);
}
```

**Forventet resultat:** 97% reduktion (34.000 → ~500 events/dag)

---

## Kategori 2: FM Migration Fuldførelse

### Status
FM-data er migreret til `sales` tabellen, men **21 filer** bruger stadig `fieldmarketing_sales`:

| Fil | Type | Antal steder |
|-----|------|--------------|
| `calculate-kpi-values/index.ts` | Edge function | 7+ |
| `calculate-kpi-incremental/index.ts` | Edge function | 3+ |
| `calculate-leaderboard-incremental/index.ts` | Edge function | 2+ |
| `tv-dashboard-data/index.ts` | Edge function | 5 |
| `CphSalesDashboard.tsx` | Dashboard | 3 |
| `FieldmarketingDashboard.tsx` | Dashboard | 2 |
| `FieldmarketingDashboardFull.tsx` | Dashboard | 2 |
| `EditSalesRegistrations.tsx` | Admin | 5 |
| `ClientDBTab.tsx` | Salary | 2 |
| `MyProfile.tsx` | Profile | 2 |
| `RevenueByClient.tsx` | Reports | 1 |
| 10 andre filer | Diverse | 1-3 |

### Løsning
Opdater alle queries til centraliseret struktur:
```typescript
// FRA:
supabase.from("fieldmarketing_sales").select(...)

// TIL:
supabase.from("sales")
  .select("id, sale_datetime, customer_phone, agent_name, raw_payload, ...")
  .eq("source", "fieldmarketing")
```

---

## Kategori 3: .single() Fejlrisiko

### Problem
93 filer bruger `.single()` hvor data måske ikke eksisterer:
```typescript
// RISIKOFYLDT - kaster fejl ved 0 eller 2+ rækker
const { data, error } = await supabase
  .from("employee_master_data")
  .select("...")
  .eq("id", userId)
  .single();
```

### Højrisiko Eksempler
- `src/pages/vagt-flow/Billing.tsx` linje 61
- `src/components/contracts/SendContractDialog.tsx` linje 348
- `supabase/functions/tv-dashboard-data/index.ts` linje 1346
- `src/hooks/useFieldmarketingSales.ts` - employee/product lookup

### Løsning
Erstat med `.maybeSingle()` hvor data ikke er garanteret:
```typescript
// SIKKERT - returnerer null i stedet for at kaste fejl
const { data, error } = await supabase
  .from("employee_master_data")
  .select("...")
  .eq("id", userId)
  .maybeSingle();
```

**Prioritet:** Fokusér på hooks og edge functions først (15-20 kritiske steder)

---

## Kategori 4: Debug Console.log i Produktion

### Problem
335+ `console.log` statements køres i produktion:

| Fil | Antal | Type |
|-----|-------|------|
| `RoleProtectedRoute.tsx` | 7 | Kører ved HVER navigation |
| `Auth.tsx` | 4 | Per login-forsøg |
| `TvBoardDirect.tsx` | 7 | I celebration effects |
| `BookingManagement.tsx` | 3 | På hver render |
| `useAuth.tsx` | 5 | Ved auth events |
| 40+ andre filer | 300+ | Diverse |

### Løsning
Wrap i development-only check:
```typescript
// FRA:
console.log("RoleProtectedRoute DEBUG:", { userEmail, positionPermission, ... });

// TIL:
if (import.meta.env.DEV) {
  console.log("RoleProtectedRoute DEBUG:", { userEmail, positionPermission, ... });
}
```

**Prioritet:** Start med `RoleProtectedRoute.tsx` og `useAuth.tsx` (mest trafik)

---

## Kategori 5: QueryClient Konfiguration

### Problem
QueryClient i `App.tsx` har ingen global konfiguration:
```typescript
// NUVÆRENDE (minimal)
const queryClient = new QueryClient();
```

### Løsning
Tilføj global error handling og retry logik:
```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60 * 1000, // 1 minut - reducer unødvendige refetches
      gcTime: 5 * 60 * 1000, // 5 minutter garbage collection
      retry: (failureCount, error) => {
        // Stop retry ved auth fejl
        if (error?.message?.includes("JWT") || error?.message?.includes("auth")) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false, // Reducer DB load
    },
    mutations: {
      retry: 1,
    },
  },
});
```

---

## Kategori 6: Aggressive Polling Intervaller

### Problem
Flere hooks poller for hyppigt og belaster databasen unødvendigt:

| Hook/Fil | Nuværende | Anbefalet |
|----------|-----------|-----------|
| `SendSmsDialog.tsx` | 5 sekunder | 15 sekunder |
| `SendEmployeeSmsDialog.tsx` | 5 sekunder | 15 sekunder |
| `useTimeStamps.ts` | 30 sekunder | 60 sekunder |
| `CphSalesDashboard.tsx` | 60 sekunder | 120 sekunder |

### Løsning
Juster refetchInterval:
```typescript
// FRA - for aggressivt
refetchInterval: 5000,

// TIL - mere fornuftig
refetchInterval: 15000,
```

**Forventet resultat:** ~50% reduktion i polling-relaterede DB kald

---

## Kategori 7: Døde Tabeller og Database Cleanup

### 7.1 Tomme Tabeller (30+)
Tabeller med 0 rækker der kan slettes:

| Tabel | Status |
|-------|--------|
| `communication_log` | 0 rækker (vs `communication_logs` med 462) |
| `consent_log` | 0 rækker |
| `head_to_head_battles` | 0 rækker (erstattet af `h2h_challenges`) |
| `time_off_request` | 0 rækker (erstattet af `absence_request_v2`) |
| `employee_absence` | 0 rækker (erstattet af `absence_request_v2`) |
| `team_sales_goals` | 0 rækker |
| `failed_login_attempts` | 0 rækker |
| `employee_salary_schemes` | 0 rækker |
| `weekly_goals` | 0 rækker |
| 20+ andre | 0 rækker |

### 7.2 Log Cleanup
| Tabel | Størrelse | Anbefaling |
|-------|-----------|------------|
| `login_events` | 218 MB | Fix logik + cleanup > 30 dage |
| `integration_logs` | 30 MB | Cleanup > 30 dage |
| `integration_debug_log` | 6 MB | Truncate |
| `adversus_events` | 24 MB | Retention policy |

### 7.3 Redundante Edge Functions
| Funktion | Status |
|----------|--------|
| `sync-adversus` | Erstattet af `integration-engine` |
| `adversus-sync-v2` | Erstattet af `integration-engine` |

### Løsning
```sql
-- Cleanup login_events
DELETE FROM login_events WHERE logged_in_at < NOW() - INTERVAL '30 days';

-- Cleanup integration_logs
DELETE FROM integration_logs WHERE created_at < NOW() - INTERVAL '30 days';

-- Truncate debug log
TRUNCATE integration_debug_log;

-- Drop tomme tabeller (efter verificering)
DROP TABLE IF EXISTS communication_log;
DROP TABLE IF EXISTS consent_log;
DROP TABLE IF EXISTS head_to_head_battles;
-- osv...
```

---

## Implementeringsrækkefølge

### Fase 1: Kritiske Fixes (Dag 1)
| Prioritet | Fil | Ændring |
|-----------|-----|---------|
| 1 | `src/hooks/useAuth.tsx` | Fix session_id, fjern TOKEN_REFRESHED |
| 2 | `supabase/functions/log-login-event/index.ts` | Duplicate check |
| 3 | `src/App.tsx` | QueryClient konfiguration |

### Fase 2: Performance (Dag 2)
| Prioritet | Fil | Ændring |
|-----------|-----|---------|
| 4 | `src/components/RoleProtectedRoute.tsx` | Wrap console.logs |
| 5 | Polling hooks (4 filer) | Juster intervaller |
| 6 | 15-20 filer | .single() → .maybeSingle() |

### Fase 3: FM Migration (Dag 3-4)
| Prioritet | Filer | Ændring |
|-----------|-------|---------|
| 7 | 4 edge functions | Migrér FM queries |
| 8 | 17 frontend filer | Migrér FM queries |

### Fase 4: Database Cleanup (Dag 5)
| Prioritet | Handling |
|-----------|----------|
| 9 | Kør cleanup SQL for logs |
| 10 | Drop verificerede tomme tabeller |
| 11 | Deprecer gamle sync functions |

---

## Filer der Ændres (Samlet)

### Kategori 1: Login Events
| Fil | Ændring |
|-----|---------|
| `src/hooks/useAuth.tsx` | Fix session_id, fjern TOKEN_REFRESHED, fjern getSession logging |
| `supabase/functions/log-login-event/index.ts` | Tilføj duplicate check |

### Kategori 2: FM Migration (21 filer)
| Fil | Ændring |
|-----|---------|
| `supabase/functions/calculate-kpi-values/index.ts` | Migrér FM queries |
| `supabase/functions/calculate-kpi-incremental/index.ts` | Migrér FM queries |
| `supabase/functions/calculate-leaderboard-incremental/index.ts` | Migrér FM queries |
| `supabase/functions/tv-dashboard-data/index.ts` | Migrér FM queries |
| `src/pages/dashboards/CphSalesDashboard.tsx` | Migrér FM queries |
| `src/pages/dashboards/FieldmarketingDashboard.tsx` | Migrér FM queries |
| `src/pages/dashboards/FieldmarketingDashboardFull.tsx` | Migrér FM queries |
| `src/pages/vagt-flow/EditSalesRegistrations.tsx` | Migrér FM queries |
| 13 andre filer | Migrér FM queries |

### Kategori 3-6: Stabilitet og Performance
| Fil | Ændring |
|-----|---------|
| `src/App.tsx` | QueryClient konfiguration |
| `src/components/RoleProtectedRoute.tsx` | Wrap 7 console.logs |
| `src/pages/Auth.tsx` | Wrap 4 console.logs |
| `src/components/recruitment/SendSmsDialog.tsx` | refetchInterval 5s → 15s |
| `src/components/employees/SendEmployeeSmsDialog.tsx` | refetchInterval 5s → 15s |
| `src/hooks/useTimeStamps.ts` | refetchInterval 30s → 60s |
| 15-20 filer | .single() → .maybeSingle() |

### Kategori 7: Database
| Handling | Beskrivelse |
|----------|-------------|
| SQL cleanup | Slet logs > 30 dage |
| Drop tables | 30+ tomme tabeller |
| Deprecer functions | sync-adversus, adversus-sync-v2 |

---

## Forventet Resultat

| Metrik | Før | Efter | Forbedring |
|--------|-----|-------|------------|
| Login events/dag | ~34.000 | ~500 | -97% |
| login_events tabel | 218 MB | ~5 MB | -97% |
| Database størrelse total | ~620 MB | ~350 MB | -43% |
| FM kode duplikering | 21 filer | 0 | -100% |
| Console.log overhead | 335+ steder | ~50 | -85% |
| Polling DB kald/time | ~720 | ~360 | -50% |
| .single() crash risiko | 93 filer | ~20 | -78% |
| Tomme tabeller | 30+ | 0 | -100% |

