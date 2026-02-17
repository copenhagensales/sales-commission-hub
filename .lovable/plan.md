
## Sikr at alt virker korrekt - Rettelser og flytning af Annulleringer

### Oversigt
Tre ting skal rettes for at sikre alt haenger sammen korrekt efter de seneste aendringer.

---

### Rettelse 1: Reset isDirty naar dialogen aabnes for et nyt salg
**Fil:** `src/components/cancellations/EditCartDialog.tsx`

Naar brugeren lukker dialogen og aabner den for et andet salg, forbliver `isDirty` som `true` fra forrige session. Tilfoej en reset af `isDirty` naar `saleId` aendres (via useEffect eller ved at reset i onClose-wrapperen). Bedste loesning: reset `isDirty` til `false` i en `useEffect` der lytter paa `saleId`.

### Rettelse 2: DuplicatesTab knap-stil
**Fil:** `src/components/cancellations/DuplicatesTab.tsx`

Knappen i dublet-fanen bruger stadig `variant="destructive"` med et `X`-ikon og teksten "Annuller". Den skal aendres til at matche ManualCancellationsTab:
- Variant: `outline`
- Ikon: `ShoppingCart` i stedet for `X`
- Tekst: "Rediger kurv"

### Rettelse 3: Flyt Annulleringer fra Loen til Rapporter i sidebar
**Fil:** `src/components/layout/AppSidebar.tsx`

4 aendringer i AppSidebar:

1. **Fjern fra Loen-sektionen** (linje 1556-1564): Fjern hele `canViewCancellations`-blokken fra Loen-collapsible.

2. **Tilfoej til Rapporter-sektionen** (efter linje 1319, foer `</CollapsibleContent>`): Tilfoej NavLink med `canViewCancellations`-check for `/salary/cancellations` inde i Rapporter-collapsible.

3. **Opdater `showReportsMenu`** (linje 461-462): Tilfoej `canViewCancellations` saa Rapporter-sektionen ogsaa vises for brugere der kun har adgang til annulleringer:
   `const showReportsMenu = p.canView("menu_section_reports") && (p.canViewReportsAdmin || ... || canViewCancellations);`

4. **Opdater `reportsOpen` state** (linje 76-78): Tilfoej check for `/salary/cancellations` saa Rapporter-sektionen automatisk aabner:
   `location.pathname.startsWith("/reports") || location.pathname === "/salary/cancellations"`

---

### Filer der aendres
1. `src/components/cancellations/EditCartDialog.tsx` - Reset isDirty ved nyt salg
2. `src/components/cancellations/DuplicatesTab.tsx` - Opdater knap-stil til "Rediger kurv"
3. `src/components/layout/AppSidebar.tsx` - Flyt menupunkt fra Loen til Rapporter
