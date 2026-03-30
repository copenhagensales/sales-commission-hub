

## Tilføj Produkt, Medlemsnummer og Provision — kun for ASE

### Ændringer — `src/components/cancellations/ApprovedTab.tsx`

**1. Import `CLIENT_IDS`** fra `@/utils/clientIds` og definer `ASE_CLIENT_ID`.

**2. Udvid query** til at inkludere `uploaded_data` i select-strengen.

**3. Parse ASE-felter i mapping** (kun når `clientId === ASE_CLIENT_ID`):
- `product`: fra `uploaded_data["A-kasse"]`
- `memberNumber`: fra `uploaded_data["Medlemsnummer"]`
- `provision`: fra `uploaded_data["Provision"]?.result` eller direkte tal

**4. Betinget visning af 3 ekstra kolonner** i tabellen:
- Kun vis kolonnerne **Produkt**, **Medlemsnr.** og **Provision** når `clientId === ASE_CLIENT_ID`
- Provision formateres som DKK med `formatCurrency`

Ingen andre filer skal ændres.

