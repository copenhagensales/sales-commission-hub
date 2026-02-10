

# Bloomreach_API Fallback Fix

## Problem
ASE-integrationen filtrerer 9 gyldige salg fra, fordi `lastModifiedByUser.orgCode` overskives af "Bloomreach_API" efter salget lukkes. Filteret kraever `@copenhagensales.dk`, saa disse salg afvises. Den rigtige saelger staar i `firstProcessedByUser.orgCode`.

## Loesning (2 aendringer i enreach.ts)

### AEndring 1: Fallback i `checkRule` (linje 828-847)

Naar et filter paa `lastModifiedByUser.orgCode` fejler, proev automatisk `firstProcessedByUser.orgCode` som fallback (og omvendt). Dette sikrer at filteret matcher uanset hvilket felt der indeholder den korrekte agent-email.

Konkret: efter linje 847 (den eksisterende `agentEmail` compat-logik), tilfoej en ny fallback-blok:

```
// Bloomreach_API fallback: if lastModifiedByUser.orgCode fails filter,
// try firstProcessedByUser.orgCode (and vice versa)
if (rule.field === "lastModifiedByUser.orgCode") {
  // Already resolved fieldValue from lastModifiedByUser.orgCode
  // If it doesn't pass the filter, we'll let checkRule continue with
  // the resolved value - but first try the fallback
  const fallback = this.getNestedValue(lead, "firstProcessedByUser.orgCode") ??
    this.getNestedValue(lead, "FirstProcessedByUser.orgCode");
  if (fallback && (!fieldValue || fieldValue === "")) {
    fieldValue = fallback;
  }
}
```

Men dette er ikke nok - vi skal proeve fallback naar vaerdien *ikke matcher filteret*, ikke kun naar den er tom. Derfor en bedre tilgang: Wrap hele `checkRule`-evalueringen saa vi proever fallback-feltet hvis det primaere felt fejler:

**Bedre implementering** - tilfoej fallback-logik i `passesDataFilters` legacy filter-loop (linje 900-904):

```typescript
// I stedet for:
const passesLegacy = filters.every((rule) => this.checkRule(lead, rule));

// Erstat med:
const passesLegacy = filters.every((rule) => {
  if (this.checkRule(lead, rule)) return true;
  
  // Bloomreach_API fallback: try alternative user field
  if (rule.field === "lastModifiedByUser.orgCode") {
    const fallbackRule = { ...rule, field: "firstProcessedByUser.orgCode" };
    if (this.checkRule(lead, fallbackRule)) {
      console.log(`[EnreachAdapter] Bloomreach fallback: lastModifiedByUser failed, firstProcessedByUser passed for filter`);
      return true;
    }
  }
  return false;
});
```

Samme logik tilfoejs i `checkFilterGroup` (linje 887-896) for at daekke nye filter-grupper.

### AEndring 2: Fallback i `mapLeadToSale` agent-email (linje 500-506)

Nuvaerende kode (linje 506):
```typescript
const agentOrgCode = (firstProcessedByUser?.orgCode as string) || (lastModifiedByUser?.orgCode as string) || "";
```

Dette virker allerede korrekt - den proever `firstProcessedByUser` foerst. Men vi skal ogsaa validere at vaerdien er en reel email (ikke "Bloomreach_API" eller lignende):

```typescript
const VALID_AGENT_DOMAINS = ["@copenhagensales.dk", "@cph-relatel.dk", "@cph-sales.dk"];
const isValidAgentEmail = (email: string | undefined): boolean => {
  if (!email) return false;
  return VALID_AGENT_DOMAINS.some(d => email.toLowerCase().endsWith(d));
};

const firstOrgCode = firstProcessedByUser?.orgCode as string | undefined;
const lastOrgCode = lastModifiedByUser?.orgCode as string | undefined;

// Prefer firstProcessedByUser, but validate it's a real agent email
// Fall back to lastModifiedByUser if first is invalid, and vice versa
let agentOrgCode = "";
if (isValidAgentEmail(firstOrgCode)) {
  agentOrgCode = firstOrgCode!;
} else if (isValidAgentEmail(lastOrgCode)) {
  agentOrgCode = lastOrgCode!;
} else {
  agentOrgCode = firstOrgCode || lastOrgCode || "";
}
```

## Fil-oversigt

| Fil | Linjer | AEndring |
|-----|--------|----------|
| `supabase/functions/integration-engine/adapters/enreach.ts` | ~900-904 | Fallback i `passesDataFilters` legacy loop |
| `supabase/functions/integration-engine/adapters/enreach.ts` | ~887-896 | Fallback i `checkFilterGroup` |
| `supabase/functions/integration-engine/adapters/enreach.ts` | ~500-506 | Smart agent-email validering i `mapLeadToSale` |

## Effekt
- 9 Bloomreach_API-filtrerede salg vil blive registreret ved naeste sync
- Fremtidige Bloomreach-overskrivninger haandteres automatisk
- Straightline Agency forbliver filtreret fra (ingen aendring)
- Eksisterende filtre og logik paavirkes ikke for andre klienter

