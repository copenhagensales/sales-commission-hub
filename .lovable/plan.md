
# Plan: Vis "Straksbetaling (ASE)" dynamisk baseret på medarbejderens salg

## Oversigt
I stedet for at bruge en statisk permission (`menu_immediate_payment_ase`), skal menupunktet vises automatisk for alle medarbejdere der har mindst ét ASE-salg med en prisregel der tillader straksbetaling (`allows_immediate_payment = true`).

---

## 1. Opret ny hook: `src/hooks/useHasImmediatePaymentSales.ts`

Denne hook tjekker om den aktuelle medarbejder har kvalificerende salg:

```typescript
export function useHasImmediatePaymentSales() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["has-immediate-payment-sales", user?.email],
    queryFn: async () => {
      // 1. Find employee → agent mappings
      // 2. Find ASE campaigns
      // 3. Tjek om der findes salg med allows_immediate_payment = true
      // Returnerer: boolean
    },
    enabled: !!user?.email,
    staleTime: 5 * 60 * 1000, // 5 min cache
  });
}
```

**Logik:**
1. Hent medarbejderens agent emails via `employee_agent_mapping`
2. Find ASE kampagne IDs (`client_campaigns` hvor `client_id` = ASE)
3. Søg i `sales` → `sale_items` → `product_pricing_rules`
4. Returnér `true` hvis mindst ét salg har `allows_immediate_payment = true`

---

## 2. Opdater AppSidebar.tsx

**Tilføj import:**
```typescript
import { useHasImmediatePaymentSales } from "@/hooks/useHasImmediatePaymentSales";
```

**Brug hooken:**
```typescript
const { data: hasImmediatePaymentSales } = useHasImmediatePaymentSales();
```

**Ændr betingelsen for menupunktet (linje 601-614):**
```typescript
// Før:
{p.canViewImmediatePaymentAse && (

// Efter:
{hasImmediatePaymentSales && (
```

---

## 3. Opdater mitHjemOpen state (linje 49-51)

Tilføj `/immediate-payment-ase` til listen af paths der holder Mit Hjem åben:

```typescript
const [mitHjemOpen, setMitHjemOpen] = useState(
  ["/home", "/messages", "/my-profile", "/my-feedback", "/refer-a-friend", "/my-goals", "/immediate-payment-ase"].some(path => ...)
);
```

---

## 4. Fjern statisk permission (valgfrit oprydning)

Følgende filer kan opdateres for at fjerne den nu ubrugte permission:
- `src/config/permissions.ts` - fjern `menu_immediate_payment_ase`
- `src/config/permissionKeys.ts` - fjern key
- `src/hooks/usePositionPermissions.ts` - fjern `canViewImmediatePaymentAse`
- `src/components/employees/permissions/PermissionEditorV2.tsx` - fjern fra keys array

---

## Berørte filer

| Fil | Handling |
|-----|----------|
| `src/hooks/useHasImmediatePaymentSales.ts` | **Opret** - ny hook |
| `src/components/layout/AppSidebar.tsx` | Ændr betingelse til dynamisk |
| `src/config/permissions.ts` | Fjern permission (oprydning) |
| `src/config/permissionKeys.ts` | Fjern key (oprydning) |
| `src/hooks/usePositionPermissions.ts` | Fjern helper (oprydning) |
| `src/components/employees/permissions/PermissionEditorV2.tsx` | Fjern fra array (oprydning) |

---

## Forventet resultat

1. Alle medarbejdere med mindst ét kvalificerende ASE-salg ser menupunktet
2. Medarbejdere uden kvalificerende salg ser det ikke
3. Ingen manuel tildeling af rettigheder nødvendig
4. Menupunktet opdateres automatisk når nye salg matcher kriterierne
