
# Plan: Tilføj "Straksbetaling (ASE)" under Mit Hjem

## Oversigt
Opretter en ny menu-side under "Mit Hjem" kaldet "Tilføj straksbetaling (ASE)" hvor medarbejderen kan se sine ASE-salg der har en prisregel med `allows_immediate_payment = true`.

---

## 1. Database-ændring
Ingen database-ændringer nødvendige - vi bruger eksisterende tabeller:
- `sales` (agent_email, sale_datetime, customer_company, customer_phone)
- `sale_items` (matched_pricing_rule_id, product_id)
- `product_pricing_rules` (allows_immediate_payment)
- `products` (name, client_campaign_id)
- `client_campaigns` (client_id)
- `clients` (name = 'Ase')

---

## 2. Ny side: `src/pages/ImmediatePaymentASE.tsx`

### Datahentning
1. Hent den indloggede medarbejders agent emails via `employee_agent_mapping`
2. Find alle salg hvor:
   - `sales.agent_email` matcher medarbejderens mapping
   - `sale_items.matched_pricing_rule_id` peger på en `product_pricing_rules` med `allows_immediate_payment = true`
   - Produktet tilhører ASE-klienten

### UI-struktur
```text
┌──────────────────────────────────────────────────────────────┐
│  📋 Tilføj straksbetaling (ASE)                              │
│  Se dine ASE-salg med mulighed for straksbetaling            │
├──────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ Dato       │ Produkt         │ Kunde         │ Status   │ │
│  ├────────────┼─────────────────┼───────────────┼──────────┤ │
│  │ 3. feb 26  │ Salg            │ Firma ApS     │ Afventer │ │
│  │ 1. feb 26  │ Lead            │ Kunde Aps     │ Betalt   │ │
│  └─────────────────────────────────────────────────────────┘ │
│                                                              │
│  (Tom tilstand hvis ingen salg matcher)                      │
└──────────────────────────────────────────────────────────────┘
```

---

## 3. Tilføj route i `src/routes/config.tsx`

```typescript
{ path: "/immediate-payment-ase", component: ImmediatePaymentASE, access: "role", positionPermission: "menu_immediate_payment_ase" }
```

---

## 4. Tilføj permission i `src/config/permissions.ts`

Under "Mit Hjem menu" kategorien:
```typescript
{ 
  key: "menu_immediate_payment_ase", 
  label: "Straksbetaling (ASE)", 
  description: "Adgang til at se ASE-salg med mulighed for straksbetaling", 
  hasEditOption: false 
}
```

---

## 5. Opdater sidebar i `src/components/layout/AppSidebar.tsx`

Tilføj menupunkt under "Mit Hjem" (efter "Anbefal en ven"):
```tsx
{p.canView('menu_immediate_payment_ase') && (
  <NavLink
    to="/immediate-payment-ase"
    onClick={handleNavClick}
    className={...}
  >
    <CreditCard className="h-4 w-4" />
    Straksbetaling (ASE)
  </NavLink>
)}
```

---

## 6. Opdater permission hooks

### `src/hooks/usePositionPermissions.ts`
Tilføj:
```typescript
canViewImmediatePaymentAse: hasPermission("menu_immediate_payment_ase"),
```

---

## 7. Opdater permission editor

### `src/components/employees/permissions/PermissionEditorV2.tsx`
Tilføj `menu_immediate_payment_ase` til `menu_section_personal` keys.

### `src/config/permissionKeys.ts`
Tilføj:
```typescript
menu_immediate_payment_ase: { label: 'Straksbetaling (ASE)', section: 'mit_hjem' },
```

---

## Teknisk dataflow

```text
employee_master_data
       │
       ▼ (employee_id)
employee_agent_mapping
       │
       ▼ (agent_id → agents.email)
    sales (WHERE agent_email = mapping.email)
       │
       ▼ (sale_id)
  sale_items
       │
       ▼ (matched_pricing_rule_id)
product_pricing_rules (WHERE allows_immediate_payment = true)
       │
       ▼ (product_id)
    products
       │
       ▼ (client_campaign_id)
client_campaigns (WHERE client_id = ASE client ID)
```

---

## Berørte filer

| Fil | Handling |
|-----|----------|
| `src/pages/ImmediatePaymentASE.tsx` | **Opret** ny side |
| `src/routes/config.tsx` | Tilføj route |
| `src/routes/pages.ts` | Tilføj lazy export |
| `src/config/permissions.ts` | Tilføj permission |
| `src/config/permissionKeys.ts` | Tilføj permission key |
| `src/components/layout/AppSidebar.tsx` | Tilføj menupunkt |
| `src/hooks/usePositionPermissions.ts` | Tilføj canView helper |
| `src/components/employees/permissions/PermissionEditorV2.tsx` | Tilføj til keys array |

---

## Forventet resultat

1. Medarbejdere med adgang ser "Straksbetaling (ASE)" i Mit Hjem menuen
2. Siden viser kun salg hvor produktets prisregel har `allows_immediate_payment = true`
3. Kun ASE-relaterede salg vises (filtreret på klient)
4. Hvis ingen salg matcher, vises en tom-tilstand med forklarende tekst
