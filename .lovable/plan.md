
# Plan: Fix "Straksbetaling (ASE)" menu visibility bug

## Problemet
Alexander Godsk har mange ASE-salg med `allows_immediate_payment = true`, men menupunktet vises ikke fordi hook'en `useHasImmediatePaymentSales` har to fejl:

### Fejl 1: Agent ID vs Email (linje 53)
```typescript
// NUVÆRENDE (forkert):
const agentEmails = agentMappings.map(m => m.agent_id);
// agent_id er en UUID, ikke en email!

// KORREKT:
// Skal joine med agents-tabellen for at få email
```

### Fejl 2: Forkert kolonnenavn (linje 75)
```typescript
// NUVÆRENDE (forkert):
.eq("campaign_id", campaignId)

// KORREKT:
.eq("client_campaign_id", campaignId)
```

---

## Løsning

### Ændringer i `src/hooks/useHasImmediatePaymentSales.ts`

**1. Opdater agent mapping query (linje 46-53):**
```typescript
// Hent agent emails via join
const { data: agentMappings } = await supabase
  .from("employee_agent_mapping")
  .select("agent_id, agents(email)")
  .eq("employee_id", employee.id);

if (!agentMappings || agentMappings.length === 0) return false;

// Udtræk emails fra joined data
const agentEmails = agentMappings
  .map(m => (m.agents as any)?.email)
  .filter(Boolean)
  .map((e: string) => e.toLowerCase());
```

**2. Ret kolonnenavn (linje 75):**
```typescript
// Ændr fra:
.eq("campaign_id", campaignId)

// Til:
.eq("client_campaign_id", campaignId)
```

---

## Berørte filer

| Fil | Ændring |
|-----|---------|
| `src/hooks/useHasImmediatePaymentSales.ts` | Ret agent email hentning + kolonnenavn |

---

## Forventet resultat

Efter rettelsen vil Alexander Godsk (og alle andre medarbejdere med kvalificerende ASE-salg) se menupunktet "Tilføj straksbetaling (ASE)" under "Mit Hjem".
