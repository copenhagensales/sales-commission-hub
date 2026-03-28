

## Forenkl operator-valg til 3 muligheder (alle felter)

### Ændring

**Fil: `src/components/cancellations/SellerMappingTab.tsx`, linje 146-160**

Reducer begge konstanter til kun 3 operatorer:

```typescript
const OPERATOR_LABELS: Record<string, string> = {
  any: "Ligegyldigt",
  in: "Er en af",
  not_in: "Er ikke en af",
};

const OPERATOR_SYMBOLS: Record<string, string> = {
  any: "∗",
  in: "∈",
  not_in: "∉",
};
```

Gælder alle felter (Operator, Subscription Name, Sales Department) da de alle bruger samme `OPERATOR_LABELS` og `OPERATOR_SYMBOLS`.

### Bagudkompatibilitet

`productConditionMatcher.ts` har allerede `equals` og `in` i samme case-branch, og `not_equals`/`not_in` ligeså. Eksisterende data med `equals`/`not_equals` vil stadig matche korrekt — de fjernes kun fra UI-valget.

