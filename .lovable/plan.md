

# Vis medarbejdernavne i stedet for emails på alle annullerings-faner

## Problem
Alle faner viser `agent_name` direkte fra `sales`-tabellen — dette er typisk en email eller dialer-brugernavn, ikke et rigtigt navn.

## Løsning
Opret en shared hook der resolver `agent_name` (email) → medarbejdernavn via `employee_agent_mapping` + `employee_master_data`. Anvend den i alle 5 berørte komponenter.

## Ændringer

| Fil | Ændring |
|-----|---------|
| **`src/hooks/useAgentNameResolver.ts`** (ny) | Hook der henter `employee_agent_mapping` + `employee_master_data`, bygger en `Map<string, string>` fra email/agent_name → "Fornavn Efternavn". Eksporterer `resolve(agentName: string): string`. |
| **`ManualCancellationsTab.tsx`** | Brug resolver til at vise navne i tabel + agent-filter dropdown |
| **`DuplicatesTab.tsx`** | Brug resolver til at vise navne i tabel + agent-filter |
| **`ApprovalQueueTab.tsx`** | Brug resolver til at vise navne i tabel + sælger-filter |
| **`ApprovedTab.tsx`** | Brug resolver til at vise navne i tabel + sælger-filter |
| **`UploadCancellationsTab.tsx`** | Brug resolver til at vise navne i preview-tabel |

## Teknisk detalje: `useAgentNameResolver`

```typescript
// Henter agents + employee mappings, returnerer resolve-funktion
// 1. Hent alle agents fra employee_agent_mapping (agent_id → employee_id)
// 2. Hent alle employees (id → first_name, last_name, work_email)
// 3. Byg map: agent_email.toLowerCase() → "FirstName LastName"
//    + work_email.toLowerCase() → "FirstName LastName"
//    + agent_name (if not email) → "FirstName LastName"
export function useAgentNameResolver() {
  // Returns { resolve: (agentName: string) => string, isLoading: boolean }
}
```

Anvendelse i hver komponent:
- `const { resolve } = useAgentNameResolver();`
- I tabel: `{resolve(sale.agent_name) || "-"}` i stedet for `{sale.agent_name || "-"}`
- I filter-dropdown: vis resolved navne, men filtrér stadig på original `agent_name`

