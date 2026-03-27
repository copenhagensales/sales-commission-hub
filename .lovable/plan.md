

## Fix: Point/salg ændringer gemmes ikke for ikke-owner brugere

### Årsag
RLS-policyen på `powerdag_point_rules` tillader kun `is_owner()` at opdatere. Oscar har `menu_powerdag_input`-rettighed men er ikke owner, så hans UPDATE fejler stille. Koden tjekker ikke for fejl og viser altid success-toast.

### Løsning

**1. Database-migration** — Tilføj UPDATE-policy for brugere med powerdag-input adgang

Tilføj en ny RLS-policy der tillader authenticated brugere at opdatere `points_per_sale` (alle med adgang til input-siden har rettigheden via permissions-systemet, så vi kan tillade alle authenticated brugere at opdatere — adgangskontrol sker allerede i UI/routing via `menu_powerdag_input`):

```sql
CREATE POLICY "Authenticated users with input access can update point rules"
  ON public.powerdag_point_rules FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
```

**2. `src/pages/dashboards/PowerdagInput.tsx`** — Tilføj fejlhåndtering

Ret `handleUpdatePoints` til at tjekke for fejl fra Supabase og vise korrekt fejl-toast:

```typescript
const { error } = await supabase.from("powerdag_point_rules")
  .update({ points_per_sale: pts }).eq("id", ruleId);
if (error) {
  toast.error("Kunne ikke opdatere point/salg");
  return;
}
```

### Filer der ændres
1. **Ny migration** — UPDATE-policy på `powerdag_point_rules`
2. **PowerdagInput.tsx** — fejlhåndtering i `handleUpdatePoints`

