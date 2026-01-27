
# Plan: Giv Lone Mikkelsen adgang til Løn-menuen

## Problemanalyse

I `AppSidebar.tsx` (linje 445-450) er der en hardkodet liste over bruger-IDs, der kan se Løn-menuen:

```tsx
const SALARY_ALLOWED_USER_IDS = [
  'f0fb7ec3-5f00-4fcd-a6ca-2a53669147b9', // Kasper Mikkelsen
  '71267f4e-fd9e-4c16-8fe9-da0f48ce2598', // Mathias Grubak
];
```

Lone Mikkelsens `auth_user_id` (`e1ac7b84-aedb-400e-88f6-dd24687317e4`) mangler i denne liste.

---

## Løsning

Tilføj Lone Mikkelsens bruger-ID til `SALARY_ALLOWED_USER_IDS` listen.

---

## Teknisk ændring

### Fil: `src/components/layout/AppSidebar.tsx`

**Før (linje 445-450):**
```tsx
// HARDCODED: Only Kasper Mikkelsen and Mathias Grubak can see salary menu
const SALARY_ALLOWED_USER_IDS = [
  'f0fb7ec3-5f00-4fcd-a6ca-2a53669147b9', // Kasper Mikkelsen
  '71267f4e-fd9e-4c16-8fe9-da0f48ce2598', // Mathias Grubak
];
```

**Efter:**
```tsx
// HARDCODED: Only Kasper, Mathias and Lone can see salary menu
const SALARY_ALLOWED_USER_IDS = [
  'f0fb7ec3-5f00-4fcd-a6ca-2a53669147b9', // Kasper Mikkelsen
  '71267f4e-fd9e-4c16-8fe9-da0f48ce2598', // Mathias Grubak
  'e1ac7b84-aedb-400e-88f6-dd24687317e4', // Lone Mikkelsen
];
```

---

## Bemærkning

Dette er en enkelt-linje tilføjelse. Efter deploy vil Lone kunne se Løn-menuen uden at logge ud og ind igen.
