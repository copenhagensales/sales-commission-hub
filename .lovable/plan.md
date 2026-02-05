
# Tilføj Slet Kontrakt Funktion for Ejere

## Oversigt
Giver ejere mulighed for at slette kontrakter direkte fra medarbejderens detaljeside. Dette er nyttigt for at fjerne fejlagtige eller forældede kontrakter.

## Nuværende Tilstand
- RLS-politikker tillader allerede ejere at slette kontrakter via `is_owner(auth.uid())`
- Contracts.tsx har slet-funktionalitet, men kun for ikke-underskrevne kontrakter
- EmployeeDetail.tsx viser kontrakter men har ingen slet-mulighed
- `isOwner` beregnes i usePermissions men eksporteres ikke

## Implementeringsplan

### Step 1: Eksportér isOwner fra usePermissions
Tilføj `isOwner` til return-objektet så komponenter kan tjekke ejer-status.

**Fil:** `src/hooks/usePositionPermissions.ts`

### Step 2: Tilføj Slet-funktionalitet til EmployeeDetail
Opdater kontrakt-sektionen i EmployeeDetail.tsx:

1. **Import:** Tilføj `Trash2` ikon og `AlertDialog` komponenter
2. **State:** Tilføj `deleteContractId` state til at holde styr på hvilken kontrakt der skal slettes
3. **Mutation:** Tilføj `useMutation` til at slette kontrakter (sletter først signaturer, derefter kontrakten)
4. **UI:** Tilføj slet-knap ved siden af hver kontrakt (kun synlig for ejere)
5. **Dialog:** Tilføj bekræftelsesdialog før sletning

**Fil:** `src/pages/EmployeeDetail.tsx`

## UI Design

```text
┌─────────────────────────────────────────────────────────────────┐
│  📄 Salgskonsulent kontrakt                                     │
│  Sendt 12. jan. 2026                                           │
│                                              [Afventer] [🗑️]   │
└─────────────────────────────────────────────────────────────────┘
```

- Slet-knappen vises kun for ejere
- Klikker man på slet-knappen åbnes en bekræftelsesdialog
- Bekræftelsesdialog advarer om at handlingen ikke kan fortrydes

## Bekræftelsesdialog

```text
┌────────────────────────────────────────┐
│  Slet kontrakt?                        │
│                                        │
│  Er du sikker på at du vil slette      │
│  denne kontrakt? Handlingen kan ikke   │
│  fortrydes.                            │
│                                        │
│           [Annuller] [Slet]            │
└────────────────────────────────────────┘
```

## Tekniske Detaljer

### usePermissions ændring
```typescript
return {
  // ... eksisterende exports
  isOwner, // NY - tjekker om bruger er ejer
};
```

### Slet-mutation i EmployeeDetail
```typescript
const deleteContractMutation = useMutation({
  mutationFn: async (id: string) => {
    // Slet signaturer først (foreign key)
    await supabase
      .from("contract_signatures")
      .delete()
      .eq("contract_id", id);
    
    // Derefter slet kontrakt
    const { error } = await supabase
      .from("contracts")
      .delete()
      .eq("id", id);
    
    if (error) throw error;
  },
  onSuccess: () => {
    queryClient.invalidateQueries({ 
      queryKey: ["employee-contracts", id] 
    });
    toast({ title: "Kontrakt slettet" });
  }
});
```

## Berørte Filer

| Fil | Ændring |
|-----|---------|
| `src/hooks/usePositionPermissions.ts` | Eksportér `isOwner` |
| `src/pages/EmployeeDetail.tsx` | Tilføj slet-knap, dialog og mutation |

## Sikkerhed
- RLS-politik `is_owner(auth.uid())` sikrer at kun ejere kan slette kontrakter på database-niveau
- Frontend-tjek med `isOwner` skjuler knappen for ikke-ejere
- Bekræftelsesdialog forhindrer utilsigtede sletninger

## Test
1. Log ind som ejer
2. Gå til en medarbejders detaljeside
3. Klik på "Kontrakter" tab
4. Verificér at slet-knappen vises ved hver kontrakt
5. Klik slet og bekræft i dialogen
6. Verificér at kontrakten forsvinder fra listen
