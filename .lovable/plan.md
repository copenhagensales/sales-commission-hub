

## Plan: Klikbar "mangler mapping" badge med detaljevisning

### Hvad sker der
Når du klikker på "X salg mangler produktmapping"-banneret, åbnes en dialog der viser de specifikke sale_items med `needs_mapping = true` — inkl. produktnavn, sælger, dato og salgs-ID.

### Ændringer

**Fil: `src/pages/MgTest.tsx`**

1. Udvid den eksisterende `useQuery` (linje 436-450) til at hente selve rækkerne i stedet for kun count — vi henter `id`, `adversus_product_title`, `created_at`, `quantity` og joiner `sale_id` for at få sælgernavn.

2. Tilføj state for en dialog: `showNeedsMappingDialog`.

3. Gør banneret (linje 2180-2187) klikbart med `cursor-pointer` og `onClick` der åbner dialogen.

4. Tilføj en `Dialog` der viser en tabel med de umappede items:
   - Kolonnner: Produktnavn (`adversus_product_title`), Sælger, Dato, Salgs-ID
   - Giver overblik over præcis hvilke salg der mangler mapping

Ingen data ændres — rent UI/read-only.

